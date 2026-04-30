import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/supabase-auth";
import { resolveSessionFromCookies } from "@/lib/session";

export async function GET() {
  try {
    const session = await resolveSessionFromCookies();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const response = NextResponse.json({
      user: { id: session.user.id, email: session.user.email },
    });
    if (session.refreshedTokens) {
      setAuthCookies(response, session.refreshedTokens);
    }
    return response;
  } catch {
    return NextResponse.json({ user: null });
  }
}
