import type { PortfolioThemeColors } from "@/portfolio/constants/portfolio-theme";
import { usePortfolioTheme } from "@/portfolio/context/PortfolioThemeContext";
import { PortfolioThemeToggle } from "@/portfolio/components/portfolio-theme-toggle";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";

const ANIMATION_DURATION = 380;
const STAGGER_DELAY = 70;

const CAPABILITIES = [
  {
    icon: "time-outline" as const,
    title: "Billiard session billing",
    description: "Slot-based pricing (Slot A 13:00–18:44, Slot B 18:45–02:59). Tables 1–8, 9–13, 14–17 with tiered rates; 30‑minute billing chunks.",
  },
  {
    icon: "grid-outline" as const,
    title: "Multi-table tracking",
    description: "17 billiard tables; start/checkout sessions, per-table rate and duration; session admin and history.",
  },
  {
    icon: "cart-outline" as const,
    title: "POS & sales",
    description: "Cash and wholesale sales (jualan kontan/grosir), products, barcode, receipts — same core as EdysonPOS.",
  },
  {
    icon: "wallet-outline" as const,
    title: "Shop expenses",
    description: "Expense tracking by category and date; shop_expenses table for daily operations.",
  },
  {
    icon: "print-outline" as const,
    title: "Thermal receipts",
    description: "Bluetooth thermal printing and PDF receipts; payment methods (Cash, QRIS, BNI, Mandiri).",
  },
  {
    icon: "server-outline" as const,
    title: "Neon backend",
    description: "sessions, shop_expenses, plus POS tables (barangs, jualanKontan, jualanGrosir, userProfiles) with Neon Auth login.",
  },
  {
    icon: "phone-portrait-outline" as const,
    title: "Multi-platform",
    description: "Expo app for iOS, Android, and web; EAS build for APK.",
  },
];

function createStyles(C: PortfolioThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 56 },
    headerBar: {
      flexDirection: "row" as const,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "web" ? 28 : 52,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerRightRow: { flexDirection: "row" as const, alignItems: "center", gap: 12 },
    backButton: { flexDirection: "row" as const, alignItems: "center", gap: 8, padding: 8 },
    backLabel: { fontSize: 15, color: C.textMuted, fontWeight: "500" as const },
    content: { paddingHorizontal: 28, paddingTop: 36, maxWidth: 580, alignSelf: "center" as const, width: "100%" },
    titleBadge: {
      alignSelf: "flex-start" as const,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      marginBottom: 12,
      backgroundColor: C.accentDim,
      borderWidth: 1,
      borderColor: C.border,
    },
    titleBadgeText: { fontSize: 12, fontWeight: "600" as const, color: C.accent, letterSpacing: 1, textTransform: "uppercase" as const },
    title: { fontSize: 30, fontWeight: "700" as const, color: C.text, marginBottom: 6, letterSpacing: 0.3 },
    tagline: { fontSize: 15, color: C.textMuted, marginBottom: 22 },
    tryRow: { marginBottom: 20 },
    tryButton: {
      flexDirection: "row" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
    },
    tryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
    tryHint: { fontSize: 12, marginTop: 8 },
    runHintBox: { marginBottom: 20, padding: 16, borderRadius: 12, backgroundColor: C.surfaceCard, borderWidth: 1, borderColor: C.border },
    runHintTitle: { fontSize: 13, fontWeight: "600" as const, color: C.text, marginBottom: 6 },
    runHintText: { fontSize: 13, lineHeight: 20, color: C.textMuted },
    summary: { fontSize: 15, lineHeight: 24, color: C.textMuted, marginBottom: 28 },
    sectionDivider: { flexDirection: "row" as const, alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 },
    sectionDividerLine: { flex: 1, height: 1, backgroundColor: C.border, opacity: 0.6 },
    sectionDividerLabel: { fontSize: 11, fontWeight: "600" as const, color: C.textSoft, letterSpacing: 2.5, textTransform: "uppercase" as const },
    capabilitiesList: { gap: 12, marginBottom: 32 },
    capabilityRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start",
      gap: 16,
      padding: 16,
      borderRadius: 14,
      backgroundColor: C.surfaceCard,
      borderWidth: 1,
      borderColor: C.border,
    },
    capabilityIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentDim,
      borderWidth: 1,
      borderColor: C.border,
    },
    capabilityText: { flex: 1 },
    capabilityTitle: { fontSize: 15, fontWeight: "600" as const, color: C.text, marginBottom: 4, letterSpacing: 0.2 },
    capabilityDescription: { fontSize: 14, lineHeight: 20, color: C.textMuted },
    footer: { alignItems: "center", paddingTop: 32, paddingHorizontal: 28 },
    footerLine: { width: 48, height: 1, backgroundColor: C.border, marginBottom: 12, opacity: 0.5 },
    footerText: { fontSize: 12, color: C.textSoft, letterSpacing: 0.5 },
  });
}

export default function ThreeSekawanProjectScreen() {
  const router = useRouter();
  const { colors: C, isDark } = usePortfolioTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION)}
          style={styles.headerBar}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to portfolio"
          >
            <Ionicons name="arrow-back" size={24} color={C.text} />
            <Text style={styles.backLabel}>Portfolio</Text>
          </TouchableOpacity>
          <View style={styles.headerRightRow}>
            <PortfolioThemeToggle />
          </View>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATION).delay(STAGGER_DELAY)}
          >
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>Billiard & shop</Text>
            </View>
            <Text style={styles.title}>3Sekawan</Text>
            <Text style={styles.tagline}>
              Billiard table and shop management app
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 2)}
            style={styles.tryRow}
          >
            <TouchableOpacity
              onPress={() => router.replace("/3sekawan")}
              style={[styles.tryButton, { backgroundColor: C.accent, borderColor: C.border }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open 3Sekawan app"
            >
              <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
              <Text style={styles.tryButtonText}>Open 3Sekawan app</Text>
            </TouchableOpacity>
            <Text style={[styles.tryHint, { color: C.textMuted }]}>
              Runs locally in this app (same as EdysonPOS). Sign in with Neon Auth to use billiard, POS, and expenses.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 2)}
            style={styles.runHintBox}
          >
            <Text style={styles.runHintTitle}>Run standalone (optional)</Text>
            <Text style={styles.runHintText}>
              To run 3Sekawan as a separate app: cd 3Sekawan && npm start. Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_NEON_AUTH_URL in 3Sekawan/.env.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 2)}
          >
            <Text style={styles.summary}>
              3Sekawan is an Expo app for managing billiard table sessions and shop operations.
              Session billing uses slot-based pricing (day vs evening) and table tiers (1–8, 9–13, 14–17)
              with 30‑minute billing chunks. The app also includes POS (cash and wholesale sales),
              expense tracking, thermal receipts, and Neon for sessions, shop_expenses, and
              shared POS data with Neon Auth login. It runs on iOS, Android, and web.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 3)}
            style={styles.sectionDivider}
          >
            <View style={styles.sectionDividerLine} />
            <Text style={styles.sectionDividerLabel}>Capabilities</Text>
            <View style={styles.sectionDividerLine} />
          </Animated.View>

          <View style={styles.capabilitiesList}>
            {CAPABILITIES.map((item, index) => (
              <Animated.View
                key={index}
                entering={FadeInDown.duration(ANIMATION_DURATION).delay(
                  STAGGER_DELAY * 4 + index * STAGGER_DELAY
                )}
              >
                <View style={styles.capabilityRow}>
                  <View style={styles.capabilityIcon}>
                    <Ionicons name={item.icon} size={22} color={C.accent} />
                  </View>
                  <View style={styles.capabilityText}>
                    <Text style={styles.capabilityTitle}>{item.title}</Text>
                    <Text style={styles.capabilityDescription}>{item.description}</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION).delay(
            STAGGER_DELAY * 5 + CAPABILITIES.length * STAGGER_DELAY
          )}
          style={styles.footer}
        >
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>Expo · React Native · Neon</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
