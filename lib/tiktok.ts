const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const TIKTOK_VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";

const defaultScopes = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.publish",
];

type TikTokTokenPayload = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
};

type WrappedPayload = {
  data?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string;
    log_id?: string;
  };
  message?: string;
};

type TikTokVideo = {
  id?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
};

type TikTokProfile = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  profile_deep_link?: string;
  bio_description?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
  username?: string;
};

type TikTokOAuthConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
};

export type TikTokConnectedAccount = {
  openId: string;
  displayName: string;
  handle: string;
  followers: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  weeklyViews: number[];
  verified: boolean;
};

export type TikTokTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  openId: string;
  scopes: string[];
};

function parseJsonPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { data: null, message: "TikTok response was empty." };
  }

  const wrapped = payload as WrappedPayload;
  const message =
    wrapped.error?.message ||
    wrapped.message ||
    (typeof wrapped.data?.error_description === "string"
      ? wrapped.data.error_description
      : undefined);

  return { data: wrapped.data ?? payload, message };
}

function getTikTokConfig(): TikTokOAuthConfig {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error(
      "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI are required.",
    );
  }

  return { clientKey, clientSecret, redirectUri };
}

function parseTokenPayload(input: unknown): TikTokTokenPayload {
  if (!input || typeof input !== "object") {
    return {};
  }

  return input as TikTokTokenPayload;
}

function parseScopes(scopeRaw: string | undefined) {
  if (!scopeRaw) {
    return [];
  }

  return scopeRaw
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function normalizeHandle(rawHandle: string) {
  const value = rawHandle.trim();
  if (!value) {
    return "@xeinstrentalsnyc";
  }

  return value.startsWith("@") ? value : `@${value}`;
}

export function createTikTokAuthorizeUrl(input: {
  state: string;
  scopes?: string[];
}) {
  const { clientKey, redirectUri } = getTikTokConfig();
  const scopes = input.scopes?.length ? input.scopes : defaultScopes;

  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

function tokenErrorMessage(payload: unknown, fallback: string) {
  const { message } = parseJsonPayload(payload);
  return message || fallback;
}

async function postToken(params: URLSearchParams) {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: params,
  });
  const payload = (await response.json()) as unknown;
  const { data } = parseJsonPayload(payload);
  const token = parseTokenPayload(data);

  if (!response.ok || !token.access_token || !token.refresh_token || !token.open_id) {
    throw new Error(tokenErrorMessage(payload, "TikTok token exchange failed."));
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: Number(token.expires_in ?? 0),
    refreshExpiresIn: Number(token.refresh_expires_in ?? 0),
    openId: token.open_id,
    scopes: parseScopes(token.scope),
  } satisfies TikTokTokenResponse;
}

export async function exchangeTikTokCodeForToken(code: string) {
  const { clientKey, clientSecret, redirectUri } = getTikTokConfig();
  const params = new URLSearchParams();
  params.set("client_key", clientKey);
  params.set("client_secret", clientSecret);
  params.set("code", code);
  params.set("grant_type", "authorization_code");
  params.set("redirect_uri", redirectUri);
  return postToken(params);
}

export async function refreshTikTokToken(refreshToken: string) {
  const { clientKey, clientSecret } = getTikTokConfig();
  const params = new URLSearchParams();
  params.set("client_key", clientKey);
  params.set("client_secret", clientSecret);
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);
  return postToken(params);
}

async function tiktokGet<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as unknown;
  const { data, message } = parseJsonPayload(payload);
  if (!response.ok) {
    throw new Error(message || "TikTok request failed.");
  }

  return data as T;
}

async function tiktokPost<T>(url: string, accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json()) as unknown;
  const { data, message } = parseJsonPayload(payload);
  if (!response.ok) {
    throw new Error(message || "TikTok request failed.");
  }

  return data as T;
}

async function fetchTikTokProfile(accessToken: string) {
  const fields = [
    "open_id",
    "union_id",
    "avatar_url",
    "display_name",
    "profile_deep_link",
    "bio_description",
    "is_verified",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
    "username",
  ].join(",");

  const url = `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
  const data = await tiktokGet<{ user?: TikTokProfile }>(url, accessToken);
  const profile = data.user;
  if (!profile?.open_id || !profile.display_name) {
    throw new Error("Could not load TikTok profile from connected account.");
  }
  return profile;
}

async function fetchRecentVideos(accessToken: string) {
  const listFields = ["id", "create_time"].join(",");
  const listUrl = `${TIKTOK_VIDEO_LIST_URL}?fields=${encodeURIComponent(listFields)}`;
  const list = await tiktokPost<{ videos?: TikTokVideo[] }>(listUrl, accessToken, {
    max_count: 20,
  });
  const ids = (list.videos ?? []).map((video) => video.id).filter(Boolean) as string[];
  if (!ids.length) {
    return [] as TikTokVideo[];
  }

  const queryFields = ["id", "create_time", "view_count", "like_count", "comment_count"].join(",");
  const queryUrl = `${TIKTOK_VIDEO_QUERY_URL}?fields=${encodeURIComponent(queryFields)}`;
  const query = await tiktokPost<{ videos?: TikTokVideo[] }>(queryUrl, accessToken, {
    filters: { video_ids: ids },
  });
  return query.videos ?? [];
}

function computeWeeklyViews(videos: TikTokVideo[]) {
  const buckets = new Array<number>(4).fill(0);
  const now = Date.now();

  for (const video of videos) {
    const seconds = Number(video.create_time ?? 0);
    if (!seconds) {
      continue;
    }

    const ageMs = now - seconds * 1000;
    if (ageMs < 0) {
      continue;
    }

    const weekIndex = Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000));
    if (weekIndex >= 0 && weekIndex < 4) {
      const targetIndex = 3 - weekIndex;
      buckets[targetIndex] += Number(video.view_count ?? 0);
    }
  }

  return buckets;
}

export async function loadTikTokAccountMetrics(accessToken: string) {
  const [profile, videos] = await Promise.all([
    fetchTikTokProfile(accessToken),
    fetchRecentVideos(accessToken),
  ]);

  const totalVideos = Math.max(1, videos.length);
  const totalViews = videos.reduce((sum, video) => sum + Number(video.view_count ?? 0), 0);
  const totalLikes = videos.reduce((sum, video) => sum + Number(video.like_count ?? 0), 0);
  const totalComments = videos.reduce((sum, video) => sum + Number(video.comment_count ?? 0), 0);

  const avgViews = Math.round(totalViews / totalVideos);
  const avgLikes = Math.round(totalLikes / totalVideos);
  const avgComments = Math.round(totalComments / totalVideos);
  const engagementRate =
    avgViews > 0 ? ((avgLikes + avgComments) / avgViews) * 100 : 0;

  return {
    openId: profile.open_id!,
    displayName: profile.display_name!,
    handle: normalizeHandle(profile.username || profile.display_name || ""),
    followers: Number(profile.follower_count ?? 0),
    avgViews,
    avgLikes,
    avgComments,
    engagementRate: Number(engagementRate.toFixed(2)),
    weeklyViews: computeWeeklyViews(videos),
    verified: Boolean(profile.is_verified),
  } satisfies TikTokConnectedAccount;
}
