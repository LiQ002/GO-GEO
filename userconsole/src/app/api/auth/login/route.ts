import { NextResponse } from "next/server";
import { loginToUserAPI } from "@/lib/api/server";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: "登录参数格式错误" }, { status: 400 });
  }
  if (!isLoginInput(input)) {
    return NextResponse.json({ message: "请输入账号和密码" }, { status: 400 });
  }
  return loginToUserAPI(request, {
    username: input.username.trim(),
    password: input.password,
    deviceId: input.deviceId.trim() || "web-console",
    remember: input.remember,
  });
}

function isLoginInput(value: unknown): value is {
  deviceId: string;
  password: string;
  remember: boolean;
  username: string;
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.username === "string" &&
    input.username.trim() !== "" &&
    typeof input.password === "string" &&
    input.password !== "" &&
    typeof input.deviceId === "string" &&
    typeof input.remember === "boolean"
  );
}
