import { NextResponse } from "next/server";
import {
  requireAccountType,
  requireApiSession,
  withRefreshedSessionCookies,
} from "@/lib/route-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createWhopClient, whopIsConfigured } from "@/lib/whop";

type CheckoutRequest = {
  pageId: string;
  campaignTitle: string;
};

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

    const body = (await request.json()) as Partial<CheckoutRequest>;
    const pageId = body.pageId?.trim();
    const campaignTitle = body.campaignTitle?.trim();

    if (!pageId || !campaignTitle) {
      return NextResponse.json(
        { message: "Page and campaign title are required for checkout." },
        { status: 400 },
      );
    }

    if (!whopIsConfigured()) {
      return NextResponse.json(
        {
          message:
            "WHOP_API_KEY and WHOP_COMPANY_ID are required for live checkout.",
        },
        { status: 503 },
      );
    }

    const supabase = getSupabaseServerClient();
    const pageResult = await supabase
      .from("tiktok_pages")
      .select("id,handle,display_name,price,whop_plan_id")
      .eq("id", pageId)
      .single();

    if (pageResult.error || !pageResult.data) {
      return NextResponse.json(
        { message: "Selected TikTok page was not found." },
        { status: 404 },
      );
    }

    const whop = await createWhopClient();
    if (!whop?.checkoutConfigurations) {
      return NextResponse.json(
        { message: "Whop SDK is not available in this runtime." },
        { status: 500 },
      );
    }

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const checkoutConfiguration = await whop.checkoutConfigurations.create({
      plan: {
        company_id: process.env.WHOP_COMPANY_ID,
        currency: "usd",
        initial_price: Number(pageResult.data.price),
      },
      redirect_url: `${origin}/checkout/complete`,
      allow_promo_codes: false,
      metadata: {
        marketplace: "renttok",
        creator_page_id: pageResult.data.id,
        creator_handle: pageResult.data.handle,
        creator_display_name: pageResult.data.display_name,
        campaign_title: campaignTitle,
        agent_user_id: auth.session.user.id,
        agent_email: auth.session.user.email,
        price_usd: Number(pageResult.data.price),
      },
    });

    const response = NextResponse.json({
      mode: "whop",
      planId: checkoutConfiguration.plan?.id ?? pageResult.data.whop_plan_id ?? undefined,
      sessionId: checkoutConfiguration.id,
      purchaseUrl:
        checkoutConfiguration.purchase_url ?? checkoutConfiguration.purchaseUrl,
      message: "Whop checkout configuration created.",
    });

    return withRefreshedSessionCookies(response, auth.session.refreshedTokens);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not create checkout.",
      },
      { status: 500 },
    );
  }
}
