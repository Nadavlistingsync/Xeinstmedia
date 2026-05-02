import type { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

const ONE_WEEK = 60 * 60 * 24 * 7;

type SupabaseAuthUser = {
  id?: string;
  email?: string;
  app_metadata?: {
    account_type?: string;
  };
  user_metadata?: {
    account_type?: string;
  };
};

type SupabaseAuthSessionResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: SupabaseAuthUser;
  error?: string;
  error_description?: string;
  msg?: string;
};

export type SessionUser = {
  id: string;
  email: string;
  accountType: "agent" | "creator";
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

export type SessionResolution = {
  user: SessionUser;
  refreshedTokens?: SessionTokens;
};

function resolveAccountType(
  user?: Pick<SupabaseAuthUser, "app_metadata" | "user_metadata"> | null,
) {
  if (user?.app_metadata?.account_type === "creator") {
    return "creator";
  }

  if (user?.app_metadata?.account_type === "agent") {
    return "agent";
  }

  if (user?.user_metadata?.account_type === "creator") {
    return "creator";
  }

  return "agent";
}

function normalizeSessionUser(user?: SupabaseAuthUser | null) {
  if (!user?.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    accountType: resolveAccountType(user),
  } satisfies SessionUser;
}

export function getSupabaseAuthConfig() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase auth env is missing. Set SUPABASE_URL + SUPABASE_ANON_KEY, or the compatible NEXT_PUBLIC / STORAGE_SUPABASE values in Vercel.",
    );
  }

  return { url, anonKey };
}

export const authCookie = {
  accessToken: {
    name: "renttok_access_token",
    maxAge: ONE_WEEK,
  },
  refreshToken: {
    name: "renttok_refresh_token",
    maxAge: 60 * 60 * 24 * 30,
  },
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(authCookie.accessToken.name, "", cookieOptions(0));
  response.cookies.set(authCookie.refreshToken.name, "", cookieOptions(0));
}

export function setAuthCookies(response: NextResponse, tokens: SessionTokens) {
  response.cookies.set(
    authCookie.accessToken.name,
    tokens.accessToken,
    cookieOptions(authCookie.accessToken.maxAge),
  );
  response.cookies.set(
    authCookie.refreshToken.name,
    tokens.refreshToken,
    cookieOptions(authCookie.refreshToken.maxAge),
  );
}

export async function fetchSupabaseUser(accessToken: string) {
  const { url, anonKey } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SupabaseAuthUser;
  if (!payload.id || !payload.email) {
    return null;
  }

  return normalizeSessionUser(payload);
}

function parseSessionTokens(payload: SupabaseAuthSessionResponse) {
  if (!payload.access_token || !payload.refresh_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  } satisfies SessionTokens;
}

export function sessionError(payload: SupabaseAuthSessionResponse, fallback: string) {
  return payload.error_description || payload.error || payload.msg || fallback;
}

export async function createSessionFromPassword(email: string, password: string) {
  const { url, anonKey } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as SupabaseAuthSessionResponse;
  return {
    ok: response.ok,
    tokens: parseSessionTokens(payload),
    user: normalizeSessionUser(payload.user),
    message: sessionError(payload, "Could not log in."),
  };
}

export async function createSessionFromSignup(email: string, password: string) {
  const { url, anonKey } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as SupabaseAuthSessionResponse;
  return {
    ok: response.ok,
    tokens: parseSessionTokens(payload),
    user: normalizeSessionUser(payload.user),
    message: sessionError(payload, "Could not sign up."),
  };
}

export async function refreshSession(refreshToken: string) {
  const { url, anonKey } = getSupabaseAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = (await response.json()) as SupabaseAuthSessionResponse;

  if (!response.ok) {
    return null;
  }

  const tokens = parseSessionTokens(payload);
  if (!tokens) {
    return null;
  }

  const user = normalizeSessionUser(payload.user);

  return { tokens, user };
}
