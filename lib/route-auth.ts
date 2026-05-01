import { NextResponse } from "next/server";
import { clearAuthCookies, setAuthCookies, type SessionUser } from "@/lib/supabase-auth";
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

export function requireAccountType(
  user: SessionUser,
  accountType: "agent" | "creator",
) {
  if (user.accountType === accountType) {
    return null;
  }

  return NextResponse.json(
    { message: `This action is only available to ${accountType} accounts.` },
    { status: 403 },
  );
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
