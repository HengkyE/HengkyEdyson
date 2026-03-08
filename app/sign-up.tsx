import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

/** Map API error code/message to user-facing error message. */
function getSignUpErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const o = error as { message?: string; code?: string };
  const message = String(o.message || '');

  if (o.code === 'PASSWORD_TOO_SHORT' || /password\s+too\s+short/i.test(message)) {
    return 'Password terlalu pendek.';
  }
  if (o.code === 'PASSWORD_TOO_LONG' || /password\s+too\s+long/i.test(message)) {
    return 'Password terlalu panjang.';
  }
  if (message.includes('already exists') || message.includes('already registered')) {
    return 'Email sudah terdaftar. Silakan masuk.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Terlalu banyak percobaan. Silakan tunggu sebentar.';
  }
  if (message.includes('Neon Auth URL not configured')) {
    return 'Neon Auth belum dikonfigurasi.';
  }
  if (message.includes('Invalid') || message.includes('password')) {
    return 'Pastikan password memenuhi persyaratan.';
  }

  return message || 'Pendaftaran gagal. Silakan coba lagi.';
}

/**
 * Return requirement strings to show only when sign-up fails (from API error code/message).
 * Used so we don't show a long list upfront — only the rules that were violated.
 */
function getSignUpRequirementsFromError(error: unknown): string[] {
  if (!error || typeof error !== 'object') return [];
  const o = error as { code?: string; message?: string };
  const code = o.code ? String(o.code) : '';
  const message = (o.message && String(o.message)) || '';

  const requirements: string[] = [];

  if (code === 'PASSWORD_TOO_SHORT' || /password\s+too\s+short/i.test(message)) {
    requirements.push('Password minimal 8 karakter');
  }
  if (code === 'PASSWORD_TOO_LONG' || /password\s+too\s+long/i.test(message)) {
    requirements.push('Password maksimal 72 karakter');
  }
  if (code === 'INVALID_EMAIL' || /invalid\s+email|email\s+invalid/i.test(message)) {
    requirements.push('Format email tidak valid');
  }
  if (code === 'EMAIL_REQUIRED' || /email\s+is\s+required/i.test(message)) {
    requirements.push('Email wajib diisi');
  }
  if (code === 'PASSWORD_REQUIRED' || /password\s+is\s+required/i.test(message)) {
    requirements.push('Password wajib diisi');
  }

  return requirements;
}

export default function SignUpScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signUp, loading: authLoading, isNeonAuth } = useAuth();

  const isNarrow = width < LOGIN_BREAKPOINT;
  const contentWidth = isNarrow ? undefined : Math.min(width * 0.5, LOGIN_MAX_WIDTH);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // When Neon Auth is off, redirect to login
  useEffect(() => {
    if (!isNeonAuth) {
      router.replace('/login');
    }
  }, [isNeonAuth, router]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSignUp = async () => {
    setError(null);
    setRequirements([]);

    if (!name.trim()) {
      setError('Harap masukkan nama');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Harap masukkan email dan password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Format email tidak valid');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }

    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      setRequirements(['Password minimal 8 karakter']);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }

    try {
      setLoading(true);
      const { error: authError } = await signUp(email.trim(), password, name.trim());

      if (authError) {
        setError(getSignUpErrorMessage(authError));
        setRequirements(getSignUpRequirementsFromError(authError));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Sign up error:', err);
      setError(getSignUpErrorMessage(err) || 'Terjadi kesalahan. Silakan coba lagi.');
      setRequirements(getSignUpRequirementsFromError(err));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
    } finally {
      setLoading(false);
    }
  };

  if (!isNeonAuth) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            contentWidth != null && { alignItems: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentWrapper, contentWidth != null && { maxWidth: contentWidth, width: '100%' }]}>
            <View style={styles.header}>
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    backgroundColor: colors.primary + '20',
                    transform: [{ translateX: shakeAnimation }],
                  },
                ]}
              >
                <Ionicons name="person-add" size={72} color={colors.primary} />
              </Animated.View>
              <ThemedText type="title" style={styles.title}>
                TOKO EDYSON
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
                Neon Auth · Daftar akun
              </ThemedText>
            </View>

            <Card style={styles.card} variant="elevated">
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
                Daftar akun
              </ThemedText>
              <ThemedText style={[styles.cardSubtitle, { color: colors.icon }]}>
                Buat akun baru dengan Neon Auth untuk menggunakan POS.
              </ThemedText>

              {error && (
                <Animated.View
                  style={[
                    styles.errorContainer,
                    {
                      backgroundColor: colors.error + '15',
                      borderColor: colors.error + '40',
                      transform: [{ translateX: shakeAnimation }],
                    },
                  ]}
                >
                  <Ionicons name="alert-circle" size={20} color={colors.error} />
                  <View style={styles.errorContent}>
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
                    {requirements.length > 0 && (
                      <View style={styles.requirementsList}>
                        <ThemedText style={[styles.requirementsTitle, { color: colors.text }]}>
                          Persyaratan:
                        </ThemedText>
                        {requirements.map((req, i) => (
                          <ThemedText key={i} style={[styles.requirementsItem, { color: colors.text }]}>
                            • {req}
                          </ThemedText>
                        ))}
                      </View>
                    )}
                  </View>
                </Animated.View>
              )}

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Nama</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    nameFocused && { borderColor: colors.primary, borderWidth: 2 },
                    error && { borderColor: colors.error, borderWidth: 1 },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={nameFocused ? colors.primary : colors.icon}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text }]}
                    value={name}
                    onChangeText={(text) => { setName(text); setError(null); setRequirements([]); }}
                    onFocus={() => { setNameFocused(true); setError(null); setRequirements([]); }}
                    onBlur={() => setNameFocused(false)}
                    placeholder="Nama Anda"
                    placeholderTextColor={colors.icon}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Email</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    emailFocused && { borderColor: colors.primary, borderWidth: 2 },
                    error && { borderColor: colors.error, borderWidth: 1 },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={emailFocused ? colors.primary : colors.icon}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text }]}
                    value={email}
                    onChangeText={(text) => { setEmail(text); setError(null); setRequirements([]); }}
                    onFocus={() => { setEmailFocused(true); setError(null); setRequirements([]); }}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="Masukkan email Anda"
                    placeholderTextColor={colors.icon}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Password</ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    passwordFocused && { borderColor: colors.primary, borderWidth: 2 },
                    error && { borderColor: colors.error, borderWidth: 1 },
                  ]}
                >
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
                    onChangeText={(text) => { setPassword(text); setError(null); setRequirements([]); }}
                    onFocus={() => { setPasswordFocused(true); setError(null); setRequirements([]); }}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="Minimal 8 karakter"
                    placeholderTextColor={colors.icon}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setShowPassword(!showPassword);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.icon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <Button
                title="Daftar"
                onPress={handleSignUp}
                loading={loading || authLoading}
                style={styles.signUpButton}
                size="large"
              />

              <TouchableOpacity
                onPress={() => router.replace('/login')}
                style={styles.switchModeLink}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.switchModeText, { color: colors.primary }]}>
                  Sudah punya akun? Masuk
                </ThemedText>
              </TouchableOpacity>
            </Card>

            <View style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: colors.icon }]}>
                Toko Elang - POS System
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  contentWrapper: { flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    boxShadow: '0px 4px 8px 0px rgba(0,0,0,0.1)',
    elevation: 8,
  },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  subtitle: { fontSize: 16, fontWeight: '500' },
  card: { padding: 28, borderRadius: 16 },
  cardTitle: { fontSize: 28, marginBottom: 8, fontWeight: '700' },
  cardSubtitle: { fontSize: 14, marginBottom: 24 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    gap: 8,
  },
  errorContent: { flex: 1 },
  errorText: { fontSize: 14, fontWeight: '500' },
  requirementsList: { marginTop: 10 },
  requirementsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  requirementsItem: { fontSize: 13, marginLeft: 4, marginTop: 2 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
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
  passwordInput: { paddingRight: 48 },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  eyeIcon: { position: 'absolute', right: 14, padding: 4, zIndex: 1 },
  signUpButton: { marginTop: 12, width: '100%' },
  switchModeLink: { marginTop: 16, alignItems: 'center', padding: 8 },
  switchModeText: { fontSize: 14, fontWeight: '600' },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});
