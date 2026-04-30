import { NextResponse } from "next/server";
import { clearAuthCookies, setAuthCookies } from "@/lib/supabase-auth";
import { requireSessionUser } from "@/lib/session";

export async function requireApiSession() {
  const session = await requireSessionUser();
  if (!session) {
    const response = NextResponse.json(
      { message: "Please log in to continue." },
      { status: 401 },
    );
    clearAuthCookies(response);
    return { response };
  }

  return { session };
}

export function withRefreshedSessionCookies(
  response: NextResponse,
  refreshedTokens?: { accessToken: string; refreshToken: string },
) {
  if (refreshedTokens) {
    setAuthCookies(response, refreshedTokens);
  }

  return response;
}
