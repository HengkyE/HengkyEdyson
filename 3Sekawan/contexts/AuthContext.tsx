import { getCurrentUserProfile, updateUserProfile } from "@/services/database";
import type { UserProfile } from "@/types/database";
import React, { createContext, useContext, useEffect, useState } from "react";
import * as neonAuth from "@/lib/neonAuthClient";

interface AuthUser {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: { name?: string };
  aud: string;
  created_at: string;
}

interface AuthContextType {
  session: { user: AuthUser } | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: AuthUser } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const useNeonAuth = neonAuth.isNeonAuthEnabled();

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
    if (useNeonAuth) {
      neonAuth.neonAuthGetSession().then(({ data }) => {
        setNeonSession(data);
        setLoading(false);
      });
      return;
    }
    setLoading(false);
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

  const signOut = async () => {
    if (useNeonAuth) await neonAuth.neonAuthSignOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signOut, refreshProfile }}
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
