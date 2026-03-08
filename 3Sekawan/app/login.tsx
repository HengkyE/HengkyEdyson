import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useSegments } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

const LOGIN_MAX_WIDTH = 420;
const LOGIN_BREAKPOINT = 600;

export default function LoginScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signIn, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const isNarrow = width < LOGIN_BREAKPOINT;
  const contentWidth = isNarrow ? undefined : Math.min(width * 0.5, LOGIN_MAX_WIDTH);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return '';
    
    const message = error.message || '';
    
    // Check for specific Supabase error messages
    if (message.includes('Invalid login credentials') || 
        message.includes('Email not confirmed') ||
        message.includes('Invalid email or password')) {
      return 'Password salah. Silakan coba lagi.';
    }
    
    if (message.includes('User not found')) {
      return 'Email tidak ditemukan.';
    }
    
    if (message.includes('Email rate limit exceeded')) {
      return 'Terlalu banyak percobaan. Silakan tunggu sebentar.';
    }
    
    // Default error message
    return 'Email atau password salah. Silakan coba lagi.';
  };

  const handleLogin = async () => {
    // Clear previous errors
    setError(null);
    
    if (!email.trim() || !password.trim()) {
      setError('Harap masukkan email dan password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Format email tidak valid');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }

    try {
      setLoading(true);
      const { error: signInError } = await signIn(email.trim(), password);

      if (signInError) {
        const errorMessage = getErrorMessage(signInError);
        setError(errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
        return;
      }

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Success - navigation will be handled by the auth state change (or go to tabs; stay under /3sekawan when nested)
      const prefix = segments[0] === 'three-sekawan-app' ? '/three-sekawan-app' : '';
      router.replace(prefix ? `${prefix}/(tabs)` : '/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            contentWidth != null && { alignItems: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.contentWrapper, contentWidth != null && { maxWidth: contentWidth, width: '100%' }]}>
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [{ translateX: shakeAnimation }],
                },
              ]}>
              <Image
                source={require('../assets/images/logo-tigasekawan.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
            <ThemedText type="title" style={styles.title}>
              TIGA SEKAWAN
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
              Billiard POS System
            </ThemedText>
          </View>

          <Card style={styles.card} variant="elevated">
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              {t("login.signIn")}
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: colors.icon }]}>
              {t("login.enterCredentials")}
            </ThemedText>

            {/* Error Message */}
            {error && (
              <Animated.View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: colors.error + '15',
                    borderColor: colors.error + '40',
                    transform: [{ translateX: shakeAnimation }],
                  },
                ]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </ThemedText>
              </Animated.View>
            )}

            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>Email</ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  emailFocused && {
                    borderColor: colors.primary,
                    borderWidth: 2,
                  },
                  error && {
                    borderColor: colors.error,
                    borderWidth: 1,
                  },
                ]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? colors.primary : colors.icon}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.cardBackground, color: colors.text },
                  ]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  onFocus={() => {
                    setEmailFocused(true);
                    setError(null);
                  }}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="contoh: kasir@tigasekawan.com"
                  placeholderTextColor={colors.icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>{t("login.password")}</ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  passwordFocused && {
                    borderColor: colors.primary,
                    borderWidth: 2,
                  },
                  error && {
                    borderColor: colors.error,
                    borderWidth: 1,
                  },
                ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={passwordFocused ? colors.primary : colors.icon}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { backgroundColor: colors.cardBackground, color: colors.text },
                  ]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  onFocus={() => {
                    setPasswordFocused(true);
                    setError(null);
                  }}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Masukkan password Anda"
                  placeholderTextColor={colors.icon}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowPassword(!showPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.eyeIcon}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title={t("login.signIn")}
              onPress={handleLogin}
              loading={loading || authLoading}
              style={styles.loginButton}
              size="large"
            />
          </Card>

          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: colors.icon }]}>
              TigaSekawan Billiard - POS System
            </ThemedText>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  contentWrapper: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px 0px rgba(0,0,0,0.1)',
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  card: {
    padding: 28,
    borderRadius: 16,
  },
  cardTitle: {
    fontSize: 28,
    marginBottom: 8,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.05)',
    elevation: 2,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    paddingLeft: 48,
    fontSize: 16,
    borderWidth: 0,
  },
  passwordInput: {
    paddingRight: 48,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 4,
    zIndex: 1,
  },
  loginButton: {
    marginTop: 12,
    width: '100%',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
});

