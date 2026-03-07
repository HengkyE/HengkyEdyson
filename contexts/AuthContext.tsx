import { getCurrentUserProfile, updateUserProfile } from "@/edysonpos/services/database";
import type { UserProfile } from "@/edysonpos/types/database";
import React, { createContext, useContext, useEffect, useState } from "react";
import * as neonAuth from "@/lib/neonAuthClient";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

// When using Neon Auth we use a session/user shape compatible with Supabase types
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
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

      // Update lastLoginAt only if profile exists (uses Neon API or Supabase)
      if (userProfile) {
        try {
          await updateUserProfile(userId, { lastLoginAt: new Date().toISOString() });
        } catch (updateError) {
          console.warn("Could not update lastLoginAt:", updateError);
        }
      }
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      // If it's a 500 error or RLS issue, set profile to null but don't crash
      if (error?.code === "PGRST301" || error?.status === 500) {
        console.warn("Profile fetch failed - user may not have a profile yet");
      }
      setProfile(null);
    }
  };

  // Map Neon Auth session to Supabase-compatible session/user
  const setNeonSession = (data: neonAuth.NeonAuthSession | null) => {
    if (!data) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    const u = data.user;
    const supabaseUser = {
      id: u.id,
      email: u.email ?? "",
      app_metadata: {},
      user_metadata: { name: u.name },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
    setUser(supabaseUser);
    setSession({ user: supabaseUser } as Session);
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

    // Supabase: Get initial session — stop loading as soon as we have session (don't wait for profile)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id); // fetch profile in background
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [useNeonAuth]);

  const signIn = async (email: string, password: string) => {
    if (useNeonAuth) {
      const { data, error } = await neonAuth.neonAuthSignIn(email, password);
      if (error) {
        return { error: { message: error.message } };
      }
      if (data) setNeonSession(data);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      await fetchProfile(data.session.user.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    if (useNeonAuth) {
      await neonAuth.neonAuthSignOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
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
