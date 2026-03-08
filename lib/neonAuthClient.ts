/**
 * Neon Auth (Better Auth) client for React Native / Expo.
 * Uses fetch + AsyncStorage because cross-origin cookies don't work in RN.
 * Aligned with Neon Auth docs: https://neon.com/docs/auth/overview
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "neon_auth_session";
const SESSION_TOKEN_KEY = "neon_auth_session_token";

const BASE = process.env.EXPO_PUBLIC_NEON_AUTH_URL || "";

export function isNeonAuthEnabled(): boolean {
  return Boolean(BASE.trim());
}

/** Returns the current JWT for use with Neon Data API (Authorization: Bearer <token>). */
export async function getNeonAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface NeonAuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NeonAuthSession {
  user: NeonAuthUser;
  session: {
    id?: string;
    userId: string;
    token?: string;
    access_token?: string;
    expiresAt?: Date;
    expires_at?: number;
  };
}

function authUrl(path: string): string {
  const base = BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Normalize API response: Neon Auth / Better Auth may return { user, session } or { user, token }. */
function parseAuthResponse(json: any): { user: any; session: any } | null {
  const user = json?.user ?? json?.data?.user;
  const session = json?.session ?? json?.data?.session;
  if (user && session) return { user, session };
  // Sign-up/sign-in often returns { user, token } instead of { user, session }
  const token = json?.token ?? json?.data?.token;
  if (user && token) {
    const sessionFromToken = {
      userId: user.id,
      token,
      access_token: token,
    };
    return { user, session: sessionFromToken };
  }
  return null;
}

async function getStoredSession(): Promise<NeonAuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NeonAuthSession;
  } catch {
    return null;
  }
}

async function setStoredSession(session: NeonAuthSession | null): Promise<void> {
  if (session) {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    const token =
      session.session?.token ??
      session.session?.access_token;
    if (token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, SESSION_TOKEN_KEY]);
  }
}

function toNeonAuthSession(user: any, session: any): NeonAuthSession {
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    session: {
      id: session.id,
      userId: session.userId ?? user.id,
      token: session.token ?? session.sessionToken ?? session.access_token,
      access_token: session.access_token,
      expiresAt: session.expiresAt,
      expires_at: session.expires_at,
    },
  };
}

/**
 * Sign in with email and password.
 * API: POST {NEON_AUTH_URL}/sign-in/email with { email, password }
 */
export async function neonAuthSignIn(
  email: string,
  password: string
): Promise<{ data: NeonAuthSession | null; error: { message: string; status?: number; code?: string } | null }> {
  if (!BASE) {
    return { data: null, error: { message: "Neon Auth URL not configured" } };
  }
  try {
    const res = await fetch(authUrl("sign-in/email"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        json?.message ?? json?.error ?? (typeof json?.error === "object" ? json?.error?.message : null) ?? `Sign in failed (${res.status})`;
      const code = json?.code;
      return { data: null, error: { message: String(message), status: res.status, code: code != null ? String(code) : undefined } };
    }

    const parsed = parseAuthResponse(json);
    if (!parsed) {
      const existing = await getStoredSession();
      if (existing) return { data: existing, error: null };
      return { data: null, error: { message: "Invalid sign-in response" } };
    }

    const sessionData = toNeonAuthSession(parsed.user, parsed.session);
    await setStoredSession(sessionData);
    return { data: sessionData, error: null };
  } catch (e: any) {
    const message = e?.message || "Network error";
    return { data: null, error: { message } };
  }
}

/**
 * Sign up with email, password, and name.
 * API: POST {NEON_AUTH_URL}/sign-up/email with { email, password, name }
 * After sign-up, fetches session if not returned.
 */
export async function neonAuthSignUp(
  email: string,
  password: string,
  name: string
): Promise<{ data: NeonAuthSession | null; error: { message: string; status?: number; code?: string } | null }> {
  if (!BASE) {
    return { data: null, error: { message: "Neon Auth URL not configured" } };
  }
  try {
    const res = await fetch(authUrl("sign-up/email"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        name: (name || email.split("@")[0] || "User").trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        json?.message ?? json?.error ?? (typeof json?.error === "object" ? json?.error?.message : null) ?? `Sign up failed (${res.status})`;
      const code = json?.code;
      return { data: null, error: { message: String(message), status: res.status, code: code != null ? String(code) : undefined } };
    }

    const parsed = parseAuthResponse(json);
    if (parsed) {
      const sessionData = toNeonAuthSession(parsed.user, parsed.session);
      await setStoredSession(sessionData);
      return { data: sessionData, error: null };
    }

    // Sign-up may not return session; sign in to get one
    return neonAuthSignIn(email, password);
  } catch (e: any) {
    const message = e?.message || "Network error";
    return { data: null, error: { message } };
  }
}

/**
 * Get current session (from storage, then optionally validate with server).
 * API: GET {NEON_AUTH_URL}/session with cookie or token.
 */
export async function neonAuthGetSession(): Promise<{
  data: NeonAuthSession | null;
  error: { message: string } | null;
}> {
  if (!BASE) return { data: null, error: null };

  const stored = await getStoredSession();
  const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY).catch(() => null);

  if (token) {
    try {
      const res = await fetch(authUrl("session"), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Cookie: `better-auth.session_token=${token}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      const parsed = res.ok ? parseAuthResponse(json) : null;
      if (parsed) {
        const sessionData = toNeonAuthSession(parsed.user, parsed.session);
        await setStoredSession(sessionData);
        return { data: sessionData, error: null };
      }
    } catch {
      // Offline or server error: use stored session
    }
  }

  return { data: stored, error: null };
}

/**
 * Sign out (clear storage and call server).
 * API: POST {NEON_AUTH_URL}/sign-out
 */
export async function neonAuthSignOut(): Promise<void> {
  if (BASE) {
    try {
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY).catch(() => null);
      await fetch(authUrl("sign-out"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
        },
      });
    } catch {
      // ignore
    }
  }
  await setStoredSession(null);
}

/**
 * Get current user id for use by database layer (when using Neon API).
 */
export async function getCurrentNeonUserId(): Promise<string | null> {
  const { data } = await neonAuthGetSession();
  return data?.user?.id ?? null;
}
