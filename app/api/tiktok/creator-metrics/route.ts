import { NextResponse } from "next/server";
import { mapPageRow, type PageRow } from "@/lib/page-mapper";
import { requireApiSession, withRefreshedSessionCookies } from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  loadTikTokAccountMetrics,
  normalizeHandle,
  refreshTikTokToken,
} from "@/lib/tiktok";

type CreatorTokenRow = {
  user_id: string;
  handle: string;
  open_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  refresh_expires_at: string | null;
  scopes: string[] | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const body = (await request.json()) as { handle?: string; price?: number };
    const handle = normalizeHandle(body.handle || "@xeinstrentalsnyc");
    const requestedPrice = Number(body.price ?? 0);

    const supabase = getSupabaseServerClient();
    const tokenResult = await supabase
      .from("creator_tokens")
      .select("*")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", handle)
      .single();

    if (tokenResult.error || !tokenResult.data) {
      const connectPath = `/api/tiktok/connect/start?handle=${encodeURIComponent(handle)}`;
      return NextResponse.json(
        {
          message: `Connect ${handle} with TikTok OAuth first.`,
          connectPath,
        },
        { status: 412 },
      );
    }

    const tokenRow = tokenResult.data as CreatorTokenRow;
    let accessToken = tokenRow.access_token;
    let openId = tokenRow.open_id ?? "";
    const tokenExpiresAt = tokenRow.token_expires_at
      ? new Date(tokenRow.token_expires_at).getTime()
      : 0;
    const now = Date.now();

    if (tokenExpiresAt && tokenExpiresAt <= now + 45_000) {
      const refreshed = await refreshTikTokToken(tokenRow.refresh_token);
      accessToken = refreshed.accessToken;
      openId = refreshed.openId;
      const updatedAt = new Date();
      const refreshResult = await supabase
        .from("creator_tokens")
        .update({
          open_id: refreshed.openId,
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          token_expires_at: new Date(
            updatedAt.getTime() + refreshed.expiresIn * 1000,
          ).toISOString(),
          refresh_expires_at: new Date(
            updatedAt.getTime() + refreshed.refreshExpiresIn * 1000,
          ).toISOString(),
          scopes: refreshed.scopes,
          updated_at: updatedAt.toISOString(),
        })
        .eq("user_id", auth.session.user.id)
        .eq("handle", handle);

      if (refreshResult.error) {
        throw refreshResult.error;
      }
    }

    const metrics = await loadTikTokAccountMetrics(accessToken);
    const pageId = `tiktok_${openId || metrics.openId}`;

    const existingPageResult = await supabase
      .from("tiktok_pages")
      .select("*")
      .eq("id", pageId)
      .maybeSingle();

    if (existingPageResult.error) {
      throw existingPageResult.error;
    }

    const existing = existingPageResult.data as PageRow | null;
    const price =
      Number.isFinite(requestedPrice) && requestedPrice > 0
        ? requestedPrice
        : Number(existing?.price ?? 0);
    const deliveryDays = Number(existing?.delivery_days ?? 3);

    const pageResult = await supabase
      .from("tiktok_pages")
      .upsert(
        {
          id: pageId,
          handle,
          display_name: metrics.displayName,
          avatar_label: metrics.displayName.slice(0, 3).toUpperCase(),
          market: "New York, NY",
          niche: existing?.niche ?? "Rental Listings",
          followers: metrics.followers,
          avg_views: metrics.avgViews,
          engagement_rate: metrics.engagementRate,
          avg_likes: metrics.avgLikes,
          avg_comments: metrics.avgComments,
          price,
          delivery_days: deliveryDays,
          audience: existing?.audience ?? "NYC renters",
          verified: metrics.verified,
          top_performer: metrics.engagementRate >= 4.5,
          tags: existing?.tags ?? ["NYC", "Rentals"],
          content_notes:
            existing?.content_notes ?? [
              "Video must include listing address and neighborhood.",
              "Include rent, bedrooms, and move-in date in opening caption.",
              "Use footage you own or have permission to use.",
            ],
          weekly_views: metrics.weeklyViews,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (pageResult.error || !pageResult.data) {
      throw pageResult.error ?? new Error("Could not save TikTok metrics.");
    }

    const savedResult = await supabase
      .from("agent_saved_pages")
      .select("page_id")
      .eq("user_id", auth.session.user.id)
      .eq("page_id", pageId)
      .maybeSingle();

    if (savedResult.error) {
      throw savedResult.error;
    }

    const response = NextResponse.json({
      page: mapPageRow(pageResult.data as PageRow, Boolean(savedResult.data)),
      note: `Imported latest TikTok metrics for ${handle}.`,
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not import TikTok metrics.",
      },
      { status: 500 },
    );
  }
}
