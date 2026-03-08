import React, { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const initialCheckDone = useRef(false);

  useEffect(() => {
    if (loading) return; // Wait for auth to initialize

    const inAuthGroup = segments[0] === 'login';
    const isPortfolioRoute =
      segments[0] === 'index' ||
      segments[0] === 'portfolios' ||
      segments[0] === 'skills' ||
      segments[0] === 'projects' ||
      segments.length === 0;

    // Default landing is portfolio: on first run after load, if unauthenticated and on login or (tabs), send to /
    if (!initialCheckDone.current) {
      initialCheckDone.current = true;
      const onAppRouteWithoutAuth = !session && (inAuthGroup || segments[0] === '(tabs)');
      if (onAppRouteWithoutAuth) {
        router.replace('/');
        return;
      }
    }

    if (!session && !inAuthGroup && !isPortfolioRoute) {
      // Redirect to login if not authenticated (except portfolio and project pages)
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Redirect to home if authenticated and on login page
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) {
    // Show loading screen while checking auth (always visible: dark bar + text)
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <View style={styles.loadingTextWrap}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading…</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  loadingTextWrap: { marginTop: 12 },
  loadingText: { fontSize: 16, fontWeight: '500' as const },
};

