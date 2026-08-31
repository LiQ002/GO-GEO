import { proxySSEStream } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return proxySSEStream(request);
}
