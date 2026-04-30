export type CampaignStatus =
  | "Video Upload"
  | "Creator Approval"
  | "Posted"
  | "Completed";

export type PaymentStatus = "Pending" | "Paid" | "Released";

export type TikTokPage = {
  id: string;
  handle: string;
  displayName: string;
  avatarLabel: string;
  market: string;
  niche: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  price: number;
  deliveryDays: number;
  audience: string;
  verified: boolean;
  topPerformer: boolean;
  saved: boolean;
  tags: string[];
  contentNotes: string[];
  weeklyViews: number[];
  whopPlanId?: string;
};

export type Campaign = {
  id: string;
  title: string;
  pageId: string;
  agentEmail?: string;
  creatorHandle: string;
  creatorName: string;
  status: CampaignStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  videoName?: string;
  videoStoragePath?: string;
  videoDuration?: string;
  postedOn?: string;
  views?: number;
  likes?: number;
  comments?: number;
  engagementRate?: number;
  receiptId?: string;
  tiktokPostId?: string;
  publishMessage?: string;
};

export type CheckoutResponse = {
  mode: "whop";
  planId?: string;
  sessionId?: string;
  purchaseUrl?: string;
  receiptId?: string;
  message: string;
};
