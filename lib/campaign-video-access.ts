import type { SessionUser } from "@/lib/supabase-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type CampaignVideoRecord = {
  agent_user_id: string;
  creator_handle: string;
  video_name: string | null;
};

export async function getAuthorizedCampaignVideo(
  user: SessionUser,
  storagePath: string,
) {
  const supabase = getSupabaseServerClient();
  const campaignResult = await supabase
    .from("campaigns")
    .select("agent_user_id,creator_handle,video_name")
    .eq("video_storage_path", storagePath)
    .maybeSingle();

  if (campaignResult.error) {
    throw campaignResult.error;
  }

  const campaign = campaignResult.data as CampaignVideoRecord | null;
  if (!campaign) {
    return { supabase, campaign: null };
  }

  if (user.accountType === "agent") {
    return {
      supabase,
      campaign: campaign.agent_user_id === user.id ? campaign : null,
    };
  }

  const creatorTokenResult = await supabase
    .from("creator_tokens")
    .select("handle")
    .eq("user_id", user.id)
    .ilike("handle", campaign.creator_handle)
    .maybeSingle();

  if (creatorTokenResult.error) {
    throw creatorTokenResult.error;
  }

  return {
    supabase,
    campaign: creatorTokenResult.data ? campaign : null,
  };
}
