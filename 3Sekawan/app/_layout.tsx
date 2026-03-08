import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/auth-guard';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LanguageProvider>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="transactions" options={{ headerShown: false }} />
              <Stack.Screen name="sessions-admin" options={{ headerShown: false }} />
              <Stack.Screen name="test-connection" options={{ presentation: 'modal', title: 'Test Connection' }} />
            </Stack>
            <StatusBar style="auto" />
          </AuthGuard>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
