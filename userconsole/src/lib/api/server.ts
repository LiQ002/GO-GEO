import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSameOriginMutation, isSecureRequest } from "./request-security";
import { accessTokenNeedsRefresh, RefreshCoordinator } from "./session-refresh";
import type { LoginReply } from "./types";

export const accessCookieName = "geo_console_access";
export const refreshCookieName = "geo_console_refresh";
const persistenceCookieName = "geo_console_remember";

const backendOrigin = (
  process.env.KRATOS_USER_API_URL ?? "http://localhost:8002"
).replace(/\/$/, "");
const configuredTimeout = Number(process.env.KRATOS_USER_API_TIMEOUT_MS);
const backendTimeoutMs =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 30_000;
const configuredRefreshWindow = Number(
  process.env.GEO_CONSOLE_ACCESS_REFRESH_WINDOW_MS,
);
const accessRefreshWindowMs =
  Number.isFinite(configuredRefreshWindow) && configuredRefreshWindow >= 0
    ? configuredRefreshWindow
    : 5 * 60 * 1000;
const refreshCoordinator = new RefreshCoordinator<RefreshAttempt>(10_000);

type RefreshAttempt =
  | { kind: "success"; login: LoginReply }
  | { kind: "invalid" | "unavailable" };

type SessionState = {
  accessToken: string | undefined;
  attempt: RefreshAttempt | null;
  refreshed: LoginReply | null;
};

export async function forwardToUserAPI(
  request: Request,
  path: string,
): Promise<NextResponse> {
  if (!path.startsWith("/api/user/v1/")) {
    return NextResponse.json({ message: "不允许访问该接口" }, { status: 400 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessCookieName)?.value;
  const refreshToken = cookieStore.get(refreshCookieName)?.value;
  const remember = cookieStore.get(persistenceCookieName)?.value === "1";
  if (!accessToken && !refreshToken) {
    return unauthorizedResponse();
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  try {
    let session = await prepareSession(accessToken, refreshToken);
    let response = await callBackend(request, path, session.accessToken, body);
    if (response.status === 401 && refreshToken && !session.attempt) {
      session = await renewSession(session.accessToken, refreshToken);
      if (session.refreshed) {
        response = await callBackend(request, path, session.accessToken, body);
      }
    }

    if (response.status === 401 && session.attempt?.kind === "unavailable") {
      return sessionRefreshUnavailableResponse();
    }
    const nextResponse = await copyBackendResponse(response);
    if (session.refreshed) {
      setSessionCookies(nextResponse, session.refreshed, remember, request);
    } else if (response.status === 401) {
      clearSessionCookies(nextResponse);
    }
    return nextResponse;
  } catch (error) {
    return backendUnavailableResponse(error);
  }
}

export async function loginToUserAPI(
  request: Request,
  credentials: {
    deviceId: string;
    password: string;
    remember: boolean;
    username: string;
  },
) {
  let response: Response;
  try {
    response = await fetch(`${backendOrigin}/api/user/v1/auth/login`, {
      method: "POST",
      cache: "no-store",
      headers: forwardedHeaders(request, true),
      body: JSON.stringify({
        deviceId: credentials.deviceId,
        password: credentials.password,
        username: credentials.username,
      }),
      signal: backendSignal(),
    });
  } catch (error) {
    return backendUnavailableResponse(error);
  }
  if (!response.ok) {
    return copyBackendResponse(response);
  }

  const login = (await response.json()) as LoginReply;
  if (!login.accessToken || !login.refreshToken) {
    return NextResponse.json({ message: "登录响应缺少令牌" }, { status: 502 });
  }
  const nextResponse = NextResponse.json({ enterprise: login.enterprise });
  setSessionCookies(nextResponse, login, credentials.remember, request);
  return nextResponse;
}

export async function logoutFromUserAPI(
  request: Request,
  allSessions: boolean,
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessCookieName)?.value;
  if (accessToken) {
    await fetch(`${backendOrigin}/api/user/v1/auth/logout`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...Object.fromEntries(forwardedHeaders(request, true)),
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ allSessions }),
      signal: backendSignal(),
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}

function backendURL(request: Request, path: string) {
  const incoming = new URL(request.url);
  return `${backendOrigin}${path}${incoming.search}`;
}

async function callBackend(
  request: Request,
  path: string,
  accessToken: string | undefined,
  body: ArrayBuffer | undefined,
) {
  const headers = forwardedHeaders(request, Boolean(body));
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return fetch(backendURL(request, path), {
    method: request.method,
    cache: "no-store",
    headers,
    body,
    signal: backendSignal(),
  });
}

async function prepareSession(
  accessToken: string | undefined,
  refreshToken: string | undefined,
): Promise<SessionState> {
  if (
    !refreshToken ||
    !accessTokenNeedsRefresh(accessToken, Date.now(), accessRefreshWindowMs)
  ) {
    return { accessToken, attempt: null, refreshed: null };
  }
  return renewSession(accessToken, refreshToken);
}

async function renewSession(
  accessToken: string | undefined,
  refreshToken: string,
): Promise<SessionState> {
  const attempt = await refreshAccessToken(refreshToken);
  if (attempt.kind !== "success") {
    return { accessToken, attempt, refreshed: null };
  }
  return {
    accessToken: attempt.login.accessToken,
    attempt,
    refreshed: attempt.login,
  };
}

function refreshAccessToken(refreshToken: string): Promise<RefreshAttempt> {
  const refreshKey = createHash("sha256").update(refreshToken).digest("hex");
  return refreshCoordinator.run(
    refreshKey,
    () => performTokenRefresh(refreshToken),
    (attempt) => attempt.kind === "success",
  );
}

async function performTokenRefresh(
  refreshToken: string,
): Promise<RefreshAttempt> {
  try {
    const response = await fetch(`${backendOrigin}/api/user/v1/auth/refresh`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: backendSignal(),
    });
    if (!response.ok) {
      return [400, 401, 403].includes(response.status)
        ? { kind: "invalid" }
        : { kind: "unavailable" };
    }
    const login = (await response.json()) as LoginReply;
    return login.accessToken && login.refreshToken
      ? { kind: "success", login }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

async function copyBackendResponse(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers,
  });
}

// proxySSEStream 将后端 SSE 连接流式转发给浏览器。
// 用于实时推送 GEO 收录/发文任务完成事件。
//
// 注意：SSE 代理不用 NextResponse（改用原生 Response）也不做 token 续期。
// 原因：NextResponse 设置 cookies 时会持有 response.body 流的额外引用，
// 客户端断开后流无法被 GC，导致 V8 堆内存持续增长直至 OOM。
// 原生 Response 直接传递流，不持有引用，可被正常 GC 回收。
// token 续期由前端的普通 API 请求（forwardToUserAPI）负责，
// SSE 连接建立时 token 有效即可；token 过期则返回 401，客户端重连时
// cookie 已被其他请求刷新。
export async function proxySSEStream(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessCookieName)?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const response = await fetch(`${backendOrigin}/api/user/v1/events/stream`, {
    headers: { authorization: `Bearer ${accessToken}` },
    // 客户端断开时 request.signal 触发 abort，后端 SSE 连接立即释放。
    signal: AbortSignal.any([
      request.signal,
      AbortSignal.timeout(3600_000),
    ]),
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { message: "SSE 连接失败" },
      { status: response.status || 502 },
    );
  }

  // 用原生 Response 转发流，避免 NextResponse 持有流引用导致内存泄漏。
  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

function forwardedHeaders(request: Request, hasBody: boolean) {
  const headers = new Headers();
  if (hasBody)
    headers.set(
      "content-type",
      request.headers.get("content-type") ?? "application/json",
    );
  const userAgent = request.headers.get("user-agent");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (userAgent) headers.set("user-agent", userAgent);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return headers;
}

function setSessionCookies(
  response: NextResponse,
  login: LoginReply,
  remember: boolean,
  request: Request,
) {
  const secure = isSecureRequest(request);
  const accessExpires = login.accessExpiresAt
    ? new Date(login.accessExpiresAt)
    : undefined;
  response.cookies.set(accessCookieName, login.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: accessExpires,
  });
  response.cookies.set(refreshCookieName, login.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
  response.cookies.set(persistenceCookieName, remember ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(accessCookieName, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(refreshCookieName, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(persistenceCookieName, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

function unauthorizedResponse() {
  return NextResponse.json(
    { code: 401, message: "登录状态已失效", reason: "AUTH_REQUIRED" },
    { status: 401 },
  );
}

function sessionRefreshUnavailableResponse() {
  return NextResponse.json(
    {
      code: 502,
      message: "登录续期暂时不可用，请稍后重试",
      reason: "SESSION_REFRESH_UNAVAILABLE",
    },
    { status: 502 },
  );
}

function backendSignal() {
  return AbortSignal.timeout(backendTimeoutMs);
}

function backendUnavailableResponse(error: unknown) {
  const timedOut =
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError");
  return NextResponse.json(
    {
      code: timedOut ? 504 : 502,
      message: timedOut ? "后端服务请求超时" : "无法连接后端服务",
      reason: timedOut ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE",
    },
    { status: timedOut ? 504 : 502 },
  );
}
