import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/auth-guard';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PortfolioThemeProvider } from '@/portfolio/context/PortfolioThemeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LanguageProvider>
          <AuthGuard>
            <PortfolioThemeProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="portfolios" options={{ headerShown: false }} />
              <Stack.Screen name="skills" options={{ headerShown: false }} />
              <Stack.Screen name="projects" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="3sekawan" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="products" options={{ headerShown: false }} />
              <Stack.Screen name="transactions" options={{ headerShown: false }} />
              <Stack.Screen name="sales" options={{ headerShown: false }} />
              <Stack.Screen name="test-connection" options={{ presentation: 'modal', title: 'Test Connection' }} />
            </Stack>
            </PortfolioThemeProvider>
            <StatusBar style="auto" />
          </AuthGuard>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
