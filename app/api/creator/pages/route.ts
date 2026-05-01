import { NextResponse } from "next/server";
import { mapPageRow, type PageRow } from "@/lib/page-mapper";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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

    const price = Number(body.price ?? 0);
    const deliveryDays = Number(body.deliveryDays ?? 0);
    const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 80) : "";
    const audience =
      typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : "";
    const tags = parseStringList(body.tags);
    const contentNotes = parseStringList(body.contentNotes);

    const supabase = getSupabaseServerClient();
    const pageResult = await supabase
      .from("tiktok_pages")
      .select("*")
      .eq("id", id)
      .single();

    if (pageResult.error || !pageResult.data) {
      return NextResponse.json({ message: "Creator page not found." }, { status: 404 });
    }

    const ownerResult = await supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", auth.session.user.id)
      .ilike("handle", (pageResult.data as PageRow).handle)
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

    const updatePayload: Record<string, unknown> = {};
    if (body.price !== undefined && Number.isFinite(price) && price >= 0) {
      updatePayload.price = price;
    }
    if (
      body.deliveryDays !== undefined &&
      Number.isFinite(deliveryDays) &&
      deliveryDays >= 1 &&
      deliveryDays <= 14
    ) {
      updatePayload.delivery_days = deliveryDays;
    }
    if (body.niche !== undefined) updatePayload.niche = niche || "Rental Listings";
    if (body.audience !== undefined) updatePayload.audience = audience;
    if (body.tags !== undefined) updatePayload.tags = tags;
    if (body.contentNotes !== undefined) updatePayload.content_notes = contentNotes;

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
