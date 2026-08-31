import { NextResponse } from "next/server";

// admin 后端提供 /uploads 静态资源服务（站点图标、渠道图标等）。
const adminApiUrl = (
  process.env.KRATOS_ADMIN_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: Context) {
  const { path } = await context.params;
  const target = `${adminApiUrl}/uploads/${path.join("/")}`;
  const upstream = await fetch(target);
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }
  const buffer = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", "no-cache, must-revalidate");
  return new NextResponse(buffer, {
    status: upstream.status,
    headers,
  });
}
