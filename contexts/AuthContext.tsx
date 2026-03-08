import { getCurrentUserProfile, updateUserProfile } from "@/edysonpos/services/database";
import type { UserProfile } from "@/edysonpos/types/database";
import React, { createContext, useContext, useEffect, useState } from "react";
import * as neonAuth from "@/lib/neonAuthClient";

// Session/user shape compatible with existing UI (id, email, etc.)
interface AuthUser {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: { name?: string };
  aud: string;
  created_at: string;
}

interface AuthSession {
  user: AuthUser;
}

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isNeonAuth: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const useNeonAuth = neonAuth.isNeonAuthEnabled();

  const fetchProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
      if (userProfile) {
        try {
          await updateUserProfile(userId, { lastLoginAt: new Date().toISOString() });
        } catch (updateError) {
          console.warn("Could not update lastLoginAt:", updateError);
        }
      }
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      if (error?.code === "PGRST301" || error?.status === 500) {
        console.warn("Profile fetch failed - user may not have a profile yet");
      }
      setProfile(null);
    }
  };

  const setNeonSession = (data: neonAuth.NeonAuthSession | null) => {
    if (!data) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    const u = data.user;
    const authUser: AuthUser = {
      id: u.id,
      email: u.email ?? "",
      app_metadata: {},
      user_metadata: { name: u.name ?? undefined },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    setUser(authUser);
    setSession({ user: authUser });
    fetchProfile(u.id);
  };

  useEffect(() => {
    let cancelled = false;
    const stopLoading = () => {
      if (!cancelled) setLoading(false);
    };
    const timeoutId = setTimeout(stopLoading, 2000);

    if (useNeonAuth) {
      neonAuth
        .neonAuthGetSession()
        .then(({ data }) => {
          if (!cancelled) {
            setNeonSession(data);
            setLoading(false);
          }
        })
        .catch(stopLoading)
        .finally(() => clearTimeout(timeoutId));
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    setLoading(false);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [useNeonAuth]);

  const signIn = async (email: string, password: string) => {
    if (useNeonAuth) {
      const { data, error } = await neonAuth.neonAuthSignIn(email, password);
      if (error) return { error: { message: error.message } };
      if (data) setNeonSession(data);
      return { error: null };
    }
    return { error: { message: "Configure Neon Auth. Set EXPO_PUBLIC_NEON_AUTH_URL in .env." } };
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (useNeonAuth) {
      const { data, error } = await neonAuth.neonAuthSignUp(email, password, name);
      if (error) return { error: { message: error.message, code: error.code } };
      if (data) setNeonSession(data);
      return { error: null };
    }
    return { error: { message: "Sign up requires Neon Auth. Set EXPO_PUBLIC_NEON_AUTH_URL." } };
  };

  const signOut = async () => {
    if (useNeonAuth) {
      await neonAuth.neonAuthSignOut();
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile, isNeonAuth: useNeonAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
