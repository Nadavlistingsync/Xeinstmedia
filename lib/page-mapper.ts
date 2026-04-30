export type PageRow = {
  id: string;
  handle: string;
  display_name: string;
  avatar_label: string | null;
  market: string;
  niche: string;
  followers: number;
  avg_views: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  price: number;
  delivery_days: number;
  audience: string;
  verified: boolean;
  top_performer: boolean;
  saved: boolean;
  tags: string[] | null;
  content_notes: string[] | null;
  weekly_views: number[] | null;
  whop_plan_id: string | null;
};

export function mapPageRow(row: PageRow, saved: boolean) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarLabel: row.avatar_label ?? row.handle.replace("@", "").slice(0, 3).toUpperCase(),
    market: row.market,
    niche: row.niche,
    followers: row.followers,
    avgViews: row.avg_views,
    engagementRate: row.engagement_rate,
    avgLikes: row.avg_likes,
    avgComments: row.avg_comments,
    price: row.price,
    deliveryDays: row.delivery_days,
    audience: row.audience,
    verified: row.verified,
    topPerformer: row.top_performer,
    saved,
    tags: row.tags ?? [],
    contentNotes: row.content_notes ?? [],
    weeklyViews: row.weekly_views ?? [],
    whopPlanId: row.whop_plan_id ?? undefined,
  };
}
