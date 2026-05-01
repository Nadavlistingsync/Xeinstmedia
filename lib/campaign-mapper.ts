export type CampaignRow = {
  id: string;
  title: string;
  page_id: string;
  agent_user_id: string;
  agent_email: string | null;
  creator_handle: string;
  creator_name: string;
  status: "Video Upload" | "Creator Approval" | "Posted" | "Completed";
  payment_status: "Pending" | "Paid" | "Released";
  paid_amount: number;
  video_name: string | null;
  video_storage_path: string | null;
  video_duration: string | null;
  posted_on: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  receipt_id: string | null;
  tiktok_post_id: string | null;
  publish_message: string | null;
};

export function mapCampaignRow(row: CampaignRow) {
  return {
    id: row.id,
    title: row.title,
    pageId: row.page_id,
    agentEmail: row.agent_email ?? undefined,
    creatorHandle: row.creator_handle,
    creatorName: row.creator_name,
    status: row.status,
    paymentStatus: row.payment_status,
    paidAmount: row.paid_amount,
    videoName: row.video_name ?? undefined,
    videoStoragePath: row.video_storage_path ?? undefined,
    videoDuration: row.video_duration ?? undefined,
    postedOn: row.posted_on ?? undefined,
    views: row.views ?? undefined,
    likes: row.likes ?? undefined,
    comments: row.comments ?? undefined,
    engagementRate: row.engagement_rate ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    tiktokPostId: row.tiktok_post_id ?? undefined,
    publishMessage: row.publish_message ?? undefined,
  };
}
