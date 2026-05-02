import { NextResponse } from "next/server";
import { getAuthorizedCampaignVideo } from "@/lib/campaign-video-access";
import { requireApiSession, withRefreshedSessionCookies } from "@/lib/route-auth";
import { getListingVideoBucket } from "@/lib/storage";

function sanitizeDownloadName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "listing-video.mp4";
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path")?.trim();
    if (!path) {
      return NextResponse.json({ message: "Video path is required." }, { status: 400 });
    }

    const { supabase, campaign } = await getAuthorizedCampaignVideo(
      auth.session.user,
      path,
    );
    if (!campaign) {
      return NextResponse.json(
        { message: "You do not have access to this campaign video." },
        { status: 403 },
      );
    }

    const bucket = getListingVideoBucket();
    const fileResult = await supabase.storage.from(bucket).download(path);
    if (fileResult.error || !fileResult.data) {
      return NextResponse.json({ message: "Could not download video." }, { status: 404 });
    }

    const fileName = sanitizeDownloadName(
      campaign.video_name ?? path.split("/").pop() ?? "listing-video.mp4",
    );
    const response = new NextResponse(fileResult.data.stream(), {
      headers: {
        "Content-Type": fileResult.data.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not download video.",
      },
      { status: 500 },
    );
  }
}
