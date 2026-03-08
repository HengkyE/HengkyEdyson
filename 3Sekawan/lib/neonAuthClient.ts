/**
 * Neon Auth (Better Auth) client for React Native.
 * Uses fetch + AsyncStorage since cross-origin cookies don't work in RN.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "neon_auth_session";
const SESSION_TOKEN_KEY = "neon_auth_session_token";

const BASE = process.env.EXPO_PUBLIC_NEON_AUTH_URL || "";

export function isNeonAuthEnabled(): boolean {
  return Boolean(BASE.trim());
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
    expiresAt?: Date;
  };
}

function authUrl(path: string): string {
  const base = BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
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
    const token = session.session?.token;
    if (token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, SESSION_TOKEN_KEY]);
  }
}

export async function neonAuthSignIn(
  email: string,
  password: string
): Promise<{ data: NeonAuthSession | null; error: { message: string; status?: number } | null }> {
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
        json?.message || json?.error || `Sign in failed (${res.status})`;
      return { data: null, error: { message, status: res.status } };
    }

    const user = json.user ?? json.data?.user;
    const session = json.session ?? json.data?.session;
    if (!user || !session) {
      const existing = await getStoredSession();
      if (existing) return { data: existing, error: null };
      return {
        data: null,
        error: { message: "Invalid sign-in response" },
      };
    }

    const sessionData: NeonAuthSession = {
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
        token: session.token ?? session.sessionToken,
        expiresAt: session.expiresAt,
      },
    };
    await setStoredSession(sessionData);
    return { data: sessionData, error: null };
  } catch (e: any) {
    const message = e?.message || "Network error";
    return { data: null, error: { message } };
  }
}

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
      if (res.ok && (json.user ?? json.data?.user)) {
        const user = json.user ?? json.data.user;
        const session = json.session ?? json.data.session ?? {};
        const sessionData: NeonAuthSession = {
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
            token: session.token ?? session.sessionToken ?? token,
            expiresAt: session.expiresAt,
          },
        };
        await setStoredSession(sessionData);
        return { data: sessionData, error: null };
      }
    } catch {
      // use stored
    }
  }

  return { data: stored, error: null };
}

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

export async function getCurrentNeonUserId(): Promise<string | null> {
  const { data } = await neonAuthGetSession();
  return data?.user?.id ?? null;
}
