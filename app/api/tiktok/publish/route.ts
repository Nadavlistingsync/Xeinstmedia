import { NextResponse } from "next/server";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeHandle, refreshTikTokToken } from "@/lib/tiktok";

type PublishRequest = {
  campaignId?: string;
  title?: string;
  caption?: string;
  videoFileName?: string;
  videoSize?: number;
  creatorHandle?: string;
};

type CreatorTokenRow = {
  user_id: string;
  handle: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "creator");
    if (roleResponse) {
      return roleResponse;
    }

    const body = (await request.json()) as PublishRequest;

    if (!body.campaignId || !body.caption || !body.videoFileName) {
      return NextResponse.json(
        { message: "Missing campaign, caption, or video filename." },
        { status: 400 },
      );
    }

    const livePostingEnabled = process.env.TIKTOK_LIVE_POSTING === "true";
    if (!livePostingEnabled) {
      return NextResponse.json(
        {
          message:
            "Set TIKTOK_LIVE_POSTING=true after TikTok Content Posting API review is approved.",
        },
        { status: 503 },
      );
    }

    const supabase = getSupabaseServerClient();
    const campaignResult = await supabase
      .from("campaigns")
      .select("id,creator_handle")
      .eq("id", body.campaignId)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      return NextResponse.json(
        { message: "Campaign not found for this creator account." },
        { status: 404 },
      );
    }

    const creatorHandle = normalizeHandle(
      body.creatorHandle || campaignResult.data.creator_handle,
    );
    const ownerResult = await supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", creatorHandle)
      .maybeSingle();

    if (ownerResult.error) {
      throw ownerResult.error;
    }

    if (!ownerResult.data) {
      return NextResponse.json(
        {
          message: `This campaign is not assigned to ${creatorHandle} on your creator account.`,
        },
        { status: 403 },
      );
    }

    const tokenResult = await supabase
      .from("creator_tokens")
      .select("*")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", creatorHandle)
      .single();

    if (tokenResult.error || !tokenResult.data) {
      return NextResponse.json(
        {
          message: `Connect ${creatorHandle} with TikTok OAuth before publishing.`,
        },
        { status: 412 },
      );
    }

    const tokenRow = tokenResult.data as CreatorTokenRow;
    let accessToken = tokenRow.access_token;
    const tokenExpiresAt = tokenRow.token_expires_at
      ? new Date(tokenRow.token_expires_at).getTime()
      : 0;
    if (tokenExpiresAt && tokenExpiresAt <= Date.now() + 45_000) {
      const refreshed = await refreshTikTokToken(tokenRow.refresh_token);
      accessToken = refreshed.accessToken;
      const updatedAt = new Date();
      const refreshResult = await supabase
        .from("creator_tokens")
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          token_expires_at: new Date(
            updatedAt.getTime() + refreshed.expiresIn * 1000,
          ).toISOString(),
          refresh_expires_at: new Date(
            updatedAt.getTime() + refreshed.refreshExpiresIn * 1000,
          ).toISOString(),
          open_id: refreshed.openId,
          scopes: refreshed.scopes,
          updated_at: updatedAt.toISOString(),
        })
        .eq("user_id", auth.session.user.id)
        .eq("handle", creatorHandle);

      if (refreshResult.error) {
        throw refreshResult.error;
      }
    }

    const fileSize = Number(body.videoSize ?? 0);
    const publishResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_info: {
            title: body.title ?? "NYC rental listing",
            description: body.caption,
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 1,
            chunk_size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 1,
            total_chunk_count: 1,
          },
        }),
      },
    );

    const payload = (await publishResponse.json()) as {
      data?: { publish_id?: string };
      error?: { message?: string };
      message?: string;
    };

    if (!publishResponse.ok) {
      return NextResponse.json(
        {
          message:
            payload?.error?.message ||
            payload?.message ||
            "TikTok publish init failed. Confirm Content Posting API approval and OAuth scopes.",
        },
        { status: 502 },
      );
    }

    const postId = payload.data?.publish_id ?? `publish_${Date.now()}`;
    const updateResult = await supabase
      .from("campaigns")
      .update({
        tiktok_post_id: postId,
        publish_message: "TikTok publish initialized.",
      })
      .eq("id", body.campaignId);

    if (updateResult.error) {
      throw updateResult.error;
    }

    const response = NextResponse.json({
      mode: "live",
      posted: true,
      postId,
      message:
        "TikTok publish initialized. Continue upload/status checks in your TikTok developer workflow.",
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not publish to TikTok.",
      },
      { status: 500 },
    );
  }
}
