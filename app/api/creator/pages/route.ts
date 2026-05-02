import { NextResponse } from "next/server";
import { enforceCreatorAccountLimit } from "@/lib/creator-accounts";
import { mapPageRow, type PageRow } from "@/lib/page-mapper";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeHandle } from "@/lib/tiktok";

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalCount(value: unknown) {
  const parsed = parseOptionalNumber(value);
  return parsed !== null && parsed >= 0 ? Math.floor(parsed) : null;
}

function buildAvatarLabel(displayName: string, handle: string) {
  const source = displayName.trim() || handle.replace("@", "");
  return source.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 3).toUpperCase() || "RT";
}

function buildManualPageId(handle: string) {
  const slug = handle.replace(/^@/, "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
  return `manual_${slug || "creator"}`;
}

function computeEngagementRate(avgViews: number, avgLikes: number, avgComments: number) {
  if (avgViews <= 0) {
    return 0;
  }

  return Number((((avgLikes + avgComments) / avgViews) * 100).toFixed(2));
}

function createDefaultDisplayName(handle: string) {
  return handle
    .replace(/^@/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(" ") || handle;
}

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

    const body = (await request.json()) as Record<string, unknown>;
    const handleInput = typeof body.handle === "string" ? body.handle : "";
    const handle = normalizeHandle(handleInput).toLowerCase();
    if (!handleInput.trim()) {
      return NextResponse.json(
        { message: "TikTok handle is required." },
        { status: 400 },
      );
    }

    const displayNameInput =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
    const priceInput = parseOptionalNumber(body.price);
    const followersInput = parseOptionalCount(body.followers);
    const avgViewsInput = parseOptionalCount(body.avgViews);
    const avgLikesInput = parseOptionalCount(body.avgLikes);
    const avgCommentsInput = parseOptionalCount(body.avgComments);

    const supabase = getSupabaseServerClient();
    const [existingPageResult, ownerResult] = await Promise.all([
      supabase.from("tiktok_pages").select("*").ilike("handle", handle).maybeSingle(),
      supabase
        .from("creator_tokens")
        .select("user_id")
        .ilike("handle", handle)
        .maybeSingle(),
    ]);

    if (existingPageResult.error) {
      throw existingPageResult.error;
    }
    if (ownerResult.error) {
      throw ownerResult.error;
    }

    if (ownerResult.data && ownerResult.data.user_id !== auth.session.user.id) {
      return NextResponse.json(
        { message: "That TikTok handle is already claimed by another creator account." },
        { status: 409 },
      );
    }

    await enforceCreatorAccountLimit(auth.session.user.id, handle);

    const existingPage = existingPageResult.data as PageRow | null;
    const displayName =
      displayNameInput ||
      existingPage?.display_name ||
      createDefaultDisplayName(handle);
    const followers = followersInput ?? existingPage?.followers ?? 0;
    const avgViews = avgViewsInput ?? existingPage?.avg_views ?? 0;
    const avgLikes = avgLikesInput ?? existingPage?.avg_likes ?? 0;
    const avgComments = avgCommentsInput ?? existingPage?.avg_comments ?? 0;
    const engagementRate = computeEngagementRate(avgViews, avgLikes, avgComments);

    const pagePayload = {
      id: existingPage?.id ?? buildManualPageId(handle),
      handle,
      display_name: displayName,
      avatar_label: buildAvatarLabel(displayName, handle),
      market: existingPage?.market ?? "New York, NY",
      niche: existingPage?.niche ?? "Rental Listings",
      followers,
      avg_views: avgViews,
      engagement_rate: engagementRate,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      price:
        priceInput !== null && priceInput >= 0 ? priceInput : Number(existingPage?.price ?? 0),
      delivery_days: existingPage?.delivery_days ?? 3,
      audience: existingPage?.audience ?? "NYC renters",
      verified: existingPage?.verified ?? false,
      top_performer: engagementRate >= 4.5,
      tags: existingPage?.tags ?? ["NYC", "Rentals"],
      content_notes:
        existingPage?.content_notes ?? [
          "Agent uploads the listing video here.",
          "Download the video from your creator dashboard before posting.",
          "Add the rent, bedrooms, and neighborhood in your caption.",
        ],
      weekly_views: existingPage?.weekly_views ?? [0, 0, 0, 0],
      whop_plan_id: existingPage?.whop_plan_id ?? null,
    };

    const pageWrite = await supabase
      .from("tiktok_pages")
      .upsert(pagePayload, { onConflict: "id" })
      .select("*")
      .single();

    if (pageWrite.error || !pageWrite.data) {
      throw pageWrite.error ?? new Error("Could not save creator page.");
    }

    const claimResult = await supabase.from("creator_tokens").upsert(
      {
        user_id: auth.session.user.id,
        handle,
        open_id: null,
        access_token: "manual",
        refresh_token: "manual",
        scopes: ["manual"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,handle" },
    );

    if (claimResult.error) {
      throw claimResult.error;
    }

    const response = NextResponse.json({
      page: mapPageRow(pageWrite.data as PageRow, false),
      note: `Listed ${handle} for agents to book.`,
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not list creator page.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "creator");
    if (roleResponse) {
      return roleResponse;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ message: "Page id is required." }, { status: 400 });
    }

    const price = parseOptionalNumber(body.price);
    const deliveryDays = parseOptionalNumber(body.deliveryDays);
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
    const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 80) : null;
    const audience =
      typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : null;
    const tags = parseStringList(body.tags);
    const contentNotes = parseStringList(body.contentNotes);
    const followers = parseOptionalCount(body.followers);
    const avgViews = parseOptionalCount(body.avgViews);
    const avgLikes = parseOptionalCount(body.avgLikes);
    const avgComments = parseOptionalCount(body.avgComments);

    const supabase = getSupabaseServerClient();
    const pageResult = await supabase
      .from("tiktok_pages")
      .select("*")
      .eq("id", id)
      .single();

    if (pageResult.error || !pageResult.data) {
      return NextResponse.json({ message: "Creator page not found." }, { status: 404 });
    }

    const currentPage = pageResult.data as PageRow;
    const ownerResult = await supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", currentPage.handle)
      .maybeSingle();

    if (ownerResult.error) {
      throw ownerResult.error;
    }

    if (!ownerResult.data) {
      return NextResponse.json(
        { message: "This TikTok page is not connected to your creator account." },
        { status: 403 },
      );
    }

    const nextFollowers = followers ?? currentPage.followers;
    const nextAvgViews = avgViews ?? currentPage.avg_views;
    const nextAvgLikes = avgLikes ?? currentPage.avg_likes;
    const nextAvgComments = avgComments ?? currentPage.avg_comments;
    const engagementRate = computeEngagementRate(
      nextAvgViews,
      nextAvgLikes,
      nextAvgComments,
    );

    const updatePayload: Record<string, unknown> = {};
    if (body.displayName !== undefined) {
      const resolvedDisplayName =
        displayName || currentPage.display_name || createDefaultDisplayName(currentPage.handle);
      updatePayload.display_name = resolvedDisplayName;
      updatePayload.avatar_label = buildAvatarLabel(resolvedDisplayName, currentPage.handle);
    }
    if (body.price !== undefined && price !== null && price >= 0) {
      updatePayload.price = price;
    }
    if (
      body.deliveryDays !== undefined &&
      deliveryDays !== null &&
      deliveryDays >= 1 &&
      deliveryDays <= 14
    ) {
      updatePayload.delivery_days = Math.floor(deliveryDays);
    }
    if (body.niche !== undefined) updatePayload.niche = niche || "Rental Listings";
    if (body.audience !== undefined) updatePayload.audience = audience ?? "";
    if (body.tags !== undefined) updatePayload.tags = tags;
    if (body.contentNotes !== undefined) updatePayload.content_notes = contentNotes;
    if (body.followers !== undefined && followers !== null) updatePayload.followers = followers;
    if (body.avgViews !== undefined && avgViews !== null) updatePayload.avg_views = avgViews;
    if (body.avgLikes !== undefined && avgLikes !== null) updatePayload.avg_likes = avgLikes;
    if (body.avgComments !== undefined && avgComments !== null) {
      updatePayload.avg_comments = avgComments;
    }

    if (
      body.followers !== undefined ||
      body.avgViews !== undefined ||
      body.avgLikes !== undefined ||
      body.avgComments !== undefined
    ) {
      updatePayload.engagement_rate = engagementRate;
      updatePayload.top_performer = engagementRate >= 4.5;
    }

    const { data, error } = await supabase
      .from("tiktok_pages")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Could not update creator page.");
    }

    const response = NextResponse.json({
      page: mapPageRow(data as PageRow, false),
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not update creator page.",
      },
      { status: 500 },
    );
  }
}
