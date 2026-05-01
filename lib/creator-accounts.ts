import { getSupabaseServerClient } from "@/lib/supabase-server";
import { MAX_CREATOR_ACCOUNTS } from "@/lib/limits";

type MinimalTokenRow = {
  handle: string;
  open_id: string | null;
};

export async function enforceCreatorAccountLimit(
  userId: string,
  handle: string,
  openId?: string,
) {
  const supabase = getSupabaseServerClient();

  const [existingHandleResult, existingOpenIdResult, countResult] = await Promise.all([
    supabase
      .from("creator_tokens")
      .select("handle")
      .eq("user_id", userId)
      .ilike("handle", handle)
      .maybeSingle(),
    openId
      ? supabase
          .from("creator_tokens")
          .select("open_id")
          .eq("user_id", userId)
          .eq("open_id", openId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("creator_tokens")
      .select("handle", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (existingHandleResult.error) {
    throw existingHandleResult.error;
  }
  if (existingOpenIdResult.error) {
    throw existingOpenIdResult.error;
  }
  if (countResult.error) {
    throw countResult.error;
  }

  const alreadyConnected =
    Boolean((existingHandleResult.data as MinimalTokenRow | null)?.handle) ||
    Boolean((existingOpenIdResult.data as MinimalTokenRow | null)?.open_id);

  if (!alreadyConnected && (countResult.count ?? 0) >= MAX_CREATOR_ACCOUNTS) {
    throw new Error(
      `You can connect up to ${MAX_CREATOR_ACCOUNTS} TikTok creator accounts.`,
    );
  }
}
