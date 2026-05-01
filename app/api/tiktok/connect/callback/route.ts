import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { enforceCreatorAccountLimit } from "@/lib/creator-accounts";
import { requireAccountType, requireApiSession } from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  exchangeTikTokCodeForToken,
  loadTikTokAccountMetrics,
  normalizeHandle,
} from "@/lib/tiktok";

const stateCookieName = "renttok_tiktok_oauth_state";

function redirectHome(input: { ok: boolean; message?: string; handle?: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const target = new URL("/", appUrl);
  target.searchParams.set("tiktok_connect", input.ok ? "success" : "error");
  if (input.message) {
    target.searchParams.set("message", input.message);
  }
  if (input.handle) {
    target.searchParams.set("handle", input.handle);
  }
  return NextResponse.redirect(target.toString());
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return redirectHome({ ok: false, message: "Please log in again and retry TikTok connect." });
    }

    const roleResponse = requireAccountType(auth.session.user, "creator");
    if (roleResponse) {
      return redirectHome({
        ok: false,
        message: "Only creator accounts can connect TikTok pages.",
      });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return redirectHome({
        ok: false,
        message: errorDescription || error,
      });
    }

    if (!code || !state) {
      return redirectHome({
        ok: false,
        message: "TikTok did not return a valid authorization code.",
      });
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(stateCookieName)?.value;
    if (!expectedState || expectedState !== state) {
      return redirectHome({
        ok: false,
        message: "TikTok OAuth state did not match. Please try again.",
      });
    }

    const [sessionUserId, rawHandle] = state.split(":");
    if (!sessionUserId || !rawHandle || sessionUserId !== auth.session.user.id) {
      return redirectHome({
        ok: false,
        message: "TikTok connection did not match the signed-in account.",
      });
    }

    const requestedHandle = normalizeHandle(rawHandle);
    const token = await exchangeTikTokCodeForToken(code);
    const metrics = await loadTikTokAccountMetrics(token.accessToken);
    const pageHandle = normalizeHandle(metrics.handle || requestedHandle);
    await enforceCreatorAccountLimit(auth.session.user.id, pageHandle, token.openId);

    const supabase = getSupabaseServerClient();
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + token.expiresIn * 1000).toISOString();
    const refreshExpiresAt = new Date(
      now.getTime() + token.refreshExpiresIn * 1000,
    ).toISOString();

    const tokenResult = await supabase.from("creator_tokens").upsert(
      {
        user_id: auth.session.user.id,
        handle: pageHandle,
        open_id: token.openId,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        token_expires_at: tokenExpiresAt,
        refresh_expires_at: refreshExpiresAt,
        scopes: token.scopes,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id,handle" },
    );

    if (tokenResult.error) {
      throw tokenResult.error;
    }

    const pageId = `tiktok_${token.openId}`;
    const pageResult = await supabase.from("tiktok_pages").upsert(
      {
        id: pageId,
        handle: pageHandle,
        display_name: metrics.displayName,
        avatar_label: metrics.displayName.slice(0, 3).toUpperCase(),
        market: "New York, NY",
        niche: "Rental Listings",
        followers: metrics.followers,
        avg_views: metrics.avgViews,
        engagement_rate: metrics.engagementRate,
        avg_likes: metrics.avgLikes,
        avg_comments: metrics.avgComments,
        price: 0,
        delivery_days: 3,
        audience: "NYC renters",
        verified: metrics.verified,
        top_performer: metrics.engagementRate >= 4.5,
        tags: ["NYC", "Rentals"],
        content_notes: [
          "Video must include listing address and neighborhood.",
          "Include rent, bedrooms, and move-in date in opening caption.",
          "Use footage you own or have permission to use.",
        ],
        weekly_views: metrics.weeklyViews,
      },
      { onConflict: "id" },
    );

    if (pageResult.error) {
      throw pageResult.error;
    }

    const response = redirectHome({
      ok: true,
      message: "TikTok account connected.",
      handle: pageHandle,
    });
    response.cookies.set(stateCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return redirectHome({
      ok: false,
      message:
        error instanceof Error ? error.message : "TikTok connect failed.",
    });
  }
}
