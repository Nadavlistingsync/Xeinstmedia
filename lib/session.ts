import { cookies } from "next/headers";
import {
  authCookie,
  fetchSupabaseUser,
  refreshSession,
  type SessionResolution,
  type SessionUser,
} from "@/lib/supabase-auth";

export async function resolveSessionFromCookies() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(authCookie.accessToken.name)?.value;
  const refreshToken = cookieStore.get(authCookie.refreshToken.name)?.value;

  if (accessToken) {
    const user = await fetchSupabaseUser(accessToken);
    if (user) {
      return { user } satisfies SessionResolution;
    }
  }

  if (!refreshToken) {
    return null;
  }

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed?.user) {
    return null;
  }

  return {
    user: refreshed.user,
    refreshedTokens: refreshed.tokens,
  } satisfies SessionResolution;
}

export async function requireSessionUser() {
  const session = await resolveSessionFromCookies();
  if (!session) {
    return null;
  }

  return session;
}

export function initialsFromEmail(user: SessionUser | null) {
  if (!user?.email) {
    return "RT";
  }

  const [namePart] = user.email.split("@");
  const chunks = namePart
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");

  return chunks.join("") || namePart.slice(0, 2).toUpperCase() || "RT";
}
