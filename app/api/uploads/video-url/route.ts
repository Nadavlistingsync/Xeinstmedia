import { NextResponse } from "next/server";
import { requireAccountType, requireApiSession, withRefreshedSessionCookies } from "@/lib/route-auth";
import { getListingVideoBucket } from "@/lib/storage";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path")?.trim();
    if (!path) {
      return NextResponse.json(
        { message: "Video path is required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const campaignResult = await supabase
      .from("campaigns")
      .select("agent_user_id,creator_handle")
      .eq("video_storage_path", path)
      .maybeSingle();

    if (campaignResult.error) {
      throw campaignResult.error;
    }

    if (!campaignResult.data) {
      return NextResponse.json(
        { message: "Campaign video not found." },
        { status: 404 },
      );
    }

    let canAccess = false;
    const agentOnly = requireAccountType(auth.session.user, "agent");
    if (!agentOnly) {
      canAccess = campaignResult.data.agent_user_id === auth.session.user.id;
    } else {
      const creatorAccess = requireAccountType(auth.session.user, "creator");
      if (!creatorAccess) {
        const creatorTokenResult = await supabase
          .from("creator_tokens")
          .select("handle")
          .eq("user_id", auth.session.user.id)
          .ilike("handle", campaignResult.data.creator_handle)
          .maybeSingle();

        if (creatorTokenResult.error) {
          throw creatorTokenResult.error;
        }

        canAccess = Boolean(creatorTokenResult.data);
      }
    }

    if (!canAccess) {
      return NextResponse.json(
        { message: "You do not have access to this campaign video." },
        { status: 403 },
      );
    }

    const bucket = getListingVideoBucket();
    const signedResult = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return NextResponse.json(
        { message: "Could not generate video URL." },
        { status: 404 },
      );
    }

    const response = NextResponse.json({
      url: signedResult.data.signedUrl,
      expiresIn: 600,
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not create signed URL.",
      },
      { status: 500 },
    );
  }
}
