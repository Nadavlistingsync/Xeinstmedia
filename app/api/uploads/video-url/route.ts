import { NextResponse } from "next/server";
import { getListingVideoBucket } from "@/lib/storage";
import { requireApiSession, withRefreshedSessionCookies } from "@/lib/route-auth";
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
