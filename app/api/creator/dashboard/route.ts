import { NextResponse } from "next/server";
import { mapCampaignRow, type CampaignRow } from "@/lib/campaign-mapper";
import { mapPageRow, type PageRow } from "@/lib/page-mapper";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const auth = await requireApiSession();
    if (auth.response) {
      return auth.response;
    }

    const roleResponse = requireAccountType(auth.session.user, "creator");
    if (roleResponse) {
      return roleResponse;
    }

    const supabase = getSupabaseServerClient();
    const tokenResult = await supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", auth.session.user.id)
      .order("updated_at", { ascending: false });

    if (tokenResult.error) {
      throw tokenResult.error;
    }

    const handles = (tokenResult.data ?? [])
      .map((item) => item.handle as string)
      .filter(Boolean);

    if (handles.length === 0) {
      const emptyResponse = NextResponse.json({
        pages: [],
        campaigns: [],
      });
      return withRefreshedSessionCookies(emptyResponse, auth.session.refreshedTokens);
    }

    const [pagesResult, campaignsResult] = await Promise.all([
      supabase.from("tiktok_pages").select("*").in("handle", handles).order("created_at"),
      supabase
        .from("campaigns")
        .select("*")
        .in("creator_handle", handles)
        .order("created_at", { ascending: false }),
    ]);

    if (pagesResult.error) {
      throw pagesResult.error;
    }

    if (campaignsResult.error) {
      throw campaignsResult.error;
    }

    const response = NextResponse.json({
      pages: (pagesResult.data as PageRow[]).map((row) => mapPageRow(row, false)),
      campaigns: (campaignsResult.data as CampaignRow[]).map(mapCampaignRow),
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not load creator dashboard.",
      },
      { status: 500 },
    );
  }
}
