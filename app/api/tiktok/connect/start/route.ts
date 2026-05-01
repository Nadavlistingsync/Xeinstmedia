import { NextResponse } from "next/server";
import { enforceCreatorAccountLimit } from "@/lib/creator-accounts";
import { requireAccountType, requireApiSession } from "@/lib/route-auth";
import { createTikTokAuthorizeUrl, normalizeHandle } from "@/lib/tiktok";

const stateCookieName = "renttok_tiktok_oauth_state";

export async function GET(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "creator");
    if (roleResponse) {
      return roleResponse;
    }

    const url = new URL(request.url);
    const handle = normalizeHandle(url.searchParams.get("handle") || "@xeinstrentalsnyc");
    await enforceCreatorAccountLimit(auth.session.user.id, handle);

    const nonce = crypto.randomUUID();
    const statePayload = `${auth.session.user.id}:${handle}:${nonce}`;
    const authorizeUrl = createTikTokAuthorizeUrl({ state: statePayload });
    const response = NextResponse.redirect(authorizeUrl);

    response.cookies.set(stateCookieName, statePayload, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start TikTok connect.";
    const fallback = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${fallback}/?tiktok_connect=error&message=${encodeURIComponent(message)}`,
    );
  }
}
