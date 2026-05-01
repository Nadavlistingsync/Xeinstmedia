import { NextResponse } from "next/server";
import { getListingVideoBucket } from "@/lib/storage";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
const allowedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function sanitizeFileName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Video file is required." },
        { status: 400 },
      );
    }

    if (!allowedVideoTypes.has(file.type)) {
      return NextResponse.json(
        {
          message: "Only MP4, MOV, and WebM files are supported.",
        },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { message: "Video must be under 200MB." },
        { status: 400 },
      );
    }

    const safeName = sanitizeFileName(file.name || "listing-video.mp4");
    const extension = safeName.split(".").pop()?.toLowerCase() || "mp4";
    const storagePath = `${auth.session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseServerClient();
    const bucket = getListingVideoBucket();
    const uploadResult = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const response = NextResponse.json({
      storagePath,
      fileName: safeName,
      fileSize: file.size,
      bucket,
      message: "Video uploaded.",
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not upload video.",
      },
      { status: 500 },
    );
  }
}
