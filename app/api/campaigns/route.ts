import { NextResponse } from "next/server";
import { mapCampaignRow, type CampaignRow } from "@/lib/campaign-mapper";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { CampaignStatus, PaymentStatus } from "@/lib/types";

export async function GET() {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "agent");
    if (roleResponse) {
      return roleResponse;
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("agent_user_id", auth.session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const response = NextResponse.json({
      campaigns: (data as CampaignRow[]).map(mapCampaignRow),
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Supabase is not configured for campaigns.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "agent");
    if (roleResponse) {
      return roleResponse;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const status = body.status as CampaignStatus | undefined;
    const paymentStatus = body.paymentStatus as PaymentStatus | undefined;
    const paidAmount = Number(body.paidAmount ?? 0);
    const videoName =
      typeof body.videoName === "string" ? body.videoName.trim().slice(0, 200) : null;
    const videoStoragePath =
      typeof body.videoStoragePath === "string"
        ? body.videoStoragePath.trim().slice(0, 300)
        : null;
    const receiptId =
      typeof body.receiptId === "string" ? body.receiptId.trim().slice(0, 160) : null;

    if (!title || !pageId) {
      return NextResponse.json(
        { message: "Campaign title and page are required." },
        { status: 400 },
      );
    }

    if (!status || !["Video Upload", "Creator Approval", "Posted", "Completed"].includes(status)) {
      return NextResponse.json(
        { message: "Campaign status is invalid." },
        { status: 400 },
      );
    }

    if (!paymentStatus || !["Pending", "Paid", "Released"].includes(paymentStatus)) {
      return NextResponse.json(
        { message: "Payment status is invalid." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return NextResponse.json(
        { message: "Paid amount must be zero or greater." },
        { status: 400 },
      );
    }

    if (!videoName || !videoStoragePath) {
      return NextResponse.json(
        { message: "Upload a video before sending the campaign." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const pageResult = await supabase
      .from("tiktok_pages")
      .select("id,handle,display_name")
      .eq("id", pageId)
      .single();

    if (pageResult.error || !pageResult.data) {
      throw pageResult.error ?? new Error("TikTok page was not found.");
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        title,
        page_id: pageResult.data.id,
        agent_user_id: auth.session.user.id,
        agent_email: auth.session.user.email,
        creator_handle: pageResult.data.handle,
        creator_name: pageResult.data.display_name,
        status,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        video_name: videoName,
        video_storage_path: videoStoragePath,
        video_duration:
          typeof body.videoDuration === "string" ? body.videoDuration.slice(0, 20) : null,
        receipt_id: receiptId,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const response = NextResponse.json({ campaign: mapCampaignRow(data as CampaignRow) });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not create campaign in Supabase.",
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

    const roleResponse = requireAccountType(auth.session.user, "agent");
    if (roleResponse) {
      return roleResponse;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ message: "Missing campaign id." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const existingResult = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("agent_user_id", auth.session.user.id)
      .single();

    if (existingResult.error || !existingResult.data) {
      return NextResponse.json(
        { message: "Campaign not found for this account." },
        { status: 404 },
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.status) updatePayload.status = body.status;
    if (body.paymentStatus) updatePayload.payment_status = body.paymentStatus;
    if (body.postedOn) updatePayload.posted_on = body.postedOn;
    if (body.views !== undefined) updatePayload.views = body.views;
    if (body.likes !== undefined) updatePayload.likes = body.likes;
    if (body.comments !== undefined) updatePayload.comments = body.comments;
    if (body.engagementRate !== undefined) updatePayload.engagement_rate = body.engagementRate;
    if (body.tiktokPostId !== undefined) updatePayload.tiktok_post_id = body.tiktokPostId;
    if (body.publishMessage !== undefined) updatePayload.publish_message = body.publishMessage;
    if (body.videoStoragePath !== undefined) updatePayload.video_storage_path = body.videoStoragePath;

    const { data, error } = await supabase
      .from("campaigns")
      .update(updatePayload)
      .eq("id", id)
      .eq("agent_user_id", auth.session.user.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const response = NextResponse.json({ campaign: mapCampaignRow(data as CampaignRow) });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not update campaign in Supabase.",
      },
      { status: 500 },
    );
  }
}
