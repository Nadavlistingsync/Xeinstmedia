import { NextResponse } from "next/server";
import { mapCampaignRow, type CampaignRow } from "@/lib/campaign-mapper";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
      return NextResponse.json({ message: "Campaign id is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const campaignResult = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    const ownerResult = await supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", (campaignResult.data as CampaignRow).creator_handle)
      .maybeSingle();

    if (ownerResult.error) {
      throw ownerResult.error;
    }

    if (!ownerResult.data) {
      return NextResponse.json(
        { message: "This campaign is not assigned to one of your creator pages." },
        { status: 403 },
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.status === "Posted" || body.status === "Completed") {
      updatePayload.status = body.status;
    }
    if (typeof body.postedOn === "string") updatePayload.posted_on = body.postedOn;
    if (typeof body.publishMessage === "string") {
      updatePayload.publish_message = body.publishMessage.slice(0, 240);
    }
    if (typeof body.tiktokPostId === "string") {
      updatePayload.tiktok_post_id = body.tiktokPostId.slice(0, 120);
    }

    const views = Number(body.views);
    const likes = Number(body.likes);
    const comments = Number(body.comments);
    const engagementRate = Number(body.engagementRate);
    if (Number.isFinite(views) && views >= 0) updatePayload.views = views;
    if (Number.isFinite(likes) && likes >= 0) updatePayload.likes = likes;
    if (Number.isFinite(comments) && comments >= 0) updatePayload.comments = comments;
    if (Number.isFinite(engagementRate) && engagementRate >= 0) {
      updatePayload.engagement_rate = engagementRate;
    }

    const { data, error } = await supabase
      .from("campaigns")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Could not update creator campaign.");
    }

    const response = NextResponse.json({
      campaign: mapCampaignRow(data as CampaignRow),
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not update creator campaign.",
      },
      { status: 500 },
    );
  }
}
