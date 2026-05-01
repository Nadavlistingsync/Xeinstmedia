import { NextResponse } from "next/server";
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

    const roleResponse = requireAccountType(auth.session.user, "agent");
    if (roleResponse) {
      return roleResponse;
    }

    const supabase = getSupabaseServerClient();
    const [pagesResult, savedResult] = await Promise.all([
      supabase
        .from("tiktok_pages")
        .select("*")
        .eq("market", "New York, NY")
        .order("engagement_rate", { ascending: false }),
      supabase
        .from("agent_saved_pages")
        .select("page_id")
        .eq("user_id", auth.session.user.id),
    ]);

    if (pagesResult.error) {
      throw pagesResult.error;
    }

    if (savedResult.error) {
      throw savedResult.error;
    }

    const savedIds = new Set(
      (savedResult.data ?? []).map((item) => item.page_id as string),
    );

    const response = NextResponse.json({
      pages: (pagesResult.data as PageRow[]).map((row) =>
        mapPageRow(row, savedIds.has(row.id)),
      ),
    });

    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Supabase is not configured for page data.",
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

    const body = (await request.json()) as { id?: string; saved?: boolean };
    if (!body.id || typeof body.saved !== "boolean") {
      return NextResponse.json(
        { message: "Missing page id or saved state." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    if (body.saved) {
      const { error } = await supabase
        .from("agent_saved_pages")
        .upsert(
          { user_id: auth.session.user.id, page_id: body.id },
          { onConflict: "user_id,page_id", ignoreDuplicates: true },
        );

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("agent_saved_pages")
        .delete()
        .eq("user_id", auth.session.user.id)
        .eq("page_id", body.id);

      if (error) {
        throw error;
      }
    }

    const { data, error } = await supabase
      .from("tiktok_pages")
      .select("*")
      .eq("id", body.id)
      .single();

    if (error) {
      throw error;
    }

    const response = NextResponse.json({
      page: mapPageRow(data as PageRow, body.saved),
    });
    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not update saved state in Supabase.",
      },
      { status: 500 },
    );
  }
}
