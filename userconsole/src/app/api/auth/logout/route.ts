import { logoutFromUserAPI } from "@/lib/api/server";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => ({}))) as {
    allSessions?: boolean;
  };
  return logoutFromUserAPI(request, Boolean(input.allSessions));
}
