import { NextResponse } from "next/server";
import { createWhopClient } from "@/lib/whop";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const whop = await createWhopClient();

  if (!process.env.WHOP_WEBHOOK_SECRET || !whop?.webhooks) {
    return NextResponse.json(
      {
        message:
          "Webhook received, but WHOP_WEBHOOK_SECRET is not configured for signature verification.",
      },
      { status: 202 },
    );
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers);
  const event = whop.webhooks.unwrap(body, { headers });

  if (event.type === "payment.succeeded") {
    const payload = event.data as Record<string, unknown>;
    const receiptId =
      (payload.id as string | undefined) ||
      (payload.receipt_id as string | undefined) ||
      (payload.receiptId as string | undefined);

    if (receiptId) {
      const supabase = getSupabaseServerClient();
      const updateResult = await supabase
        .from("campaigns")
        .update({
          payment_status: "Paid",
        })
        .eq("receipt_id", receiptId);

      if (updateResult.error) {
        console.error("[renttok] Failed to update campaign for receipt", receiptId);
      }
    }

    console.log("[renttok] Whop payment succeeded", receiptId ?? "unknown");
  }

  return new Response("OK", { status: 200 });
}
