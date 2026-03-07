import { skillCategories } from "@/portfolio/constants/skills";
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
const STAGGER_DELAY = 60;

function createStyles(C: PortfolioThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    gridContainer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" as const },
    gridLineH: { position: "absolute" as const, left: 0, right: 0, height: 1, backgroundColor: C.border, opacity: 0.1 },
    gradientOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 280,
      backgroundColor: Platform.OS === "web" ? (C.background === "#f8fafc" ? "rgba(14,165,233,0.03)" : "rgba(34,211,238,0.02)") : "transparent",
    },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 56 },
    headerBar: {
      flexDirection: "row" as const,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "web" ? 28 : 52,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backButton: { flexDirection: "row" as const, alignItems: "center", gap: 8, padding: 8 },
    backLabel: { fontSize: 15, color: C.textMuted, fontWeight: "500" as const },
    headerTitle: { fontSize: 15, fontWeight: "600" as const, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase" as const },
    headerBarPlaceholder: { flexDirection: "row" as const, alignItems: "center", gap: 12 },
    intro: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 32, alignItems: "center" },
    introTitle: { fontSize: 22, fontWeight: "700" as const, color: C.text, marginBottom: 8, letterSpacing: 0.3, textAlign: "center" as const },
    introSub: { fontSize: 15, color: C.textMuted, textAlign: "center" as const, maxWidth: 400 },
    categorySection: { paddingHorizontal: 28, marginBottom: 36, maxWidth: 600, alignSelf: "center" as const, width: "100%" },
    categoryHeader: { flexDirection: "row" as const, alignItems: "center", gap: 12, marginBottom: 16 },
    categoryHeaderLine: { flex: 1, height: 1, backgroundColor: C.border, opacity: 0.5 },
    categoryTitle: { fontSize: 12, fontWeight: "600" as const, color: C.accent, letterSpacing: 2, textTransform: "uppercase" as const },
    skillsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
    skillChip: {
      flexDirection: "row" as const,
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: C.surfaceCard,
      borderWidth: 1,
      borderColor: C.border,
    },
    skillChipIcon: { marginRight: 8 },
    skillChipText: { fontSize: 14, fontWeight: "500" as const, color: C.text, letterSpacing: 0.2 },
    footer: { alignItems: "center", paddingTop: 24, paddingHorizontal: 28 },
    footerLine: { width: 48, height: 1, backgroundColor: C.border, marginBottom: 16, opacity: 0.5 },
    backToPortfolio: { flexDirection: "row" as const, alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
    backToPortfolioText: { fontSize: 14, fontWeight: "600" as const, color: C.accent, letterSpacing: 0.3 },
  });
}

export default function SkillsScreen() {
  const router = useRouter();
  const { colors: C, isDark } = usePortfolioTheme();
  const styles = useMemo(() => createStyles(C), [C]);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Subtle grid */}
      <View style={styles.gridContainer} pointerEvents="none">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={`h-${i}`}
            style={[styles.gridLineH, { top: `${25 + i * 25}%` }]}
          />
        ))}
      </View>
      <View style={styles.gradientOverlay} pointerEvents="none" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
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
          <Text style={styles.headerTitle}>Skills</Text>
          <View style={styles.headerBarPlaceholder}>
            <PortfolioThemeToggle />
          </View>
        </Animated.View>

        {/* Intro */}
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATION).delay(STAGGER_DELAY)}
          style={styles.intro}
        >
          <Text style={styles.introTitle}>What I know & what I can do</Text>
          <Text style={styles.introSub}>
            Technologies and tools I work with to build products.
          </Text>
        </Animated.View>

        {/* Categories */}
        {skillCategories.map((category, catIndex) => (
          <Animated.View
            key={category.id}
            entering={FadeInDown.duration(ANIMATION_DURATION).delay(
              STAGGER_DELAY * 2 + catIndex * STAGGER_DELAY
            )}
            style={styles.categorySection}
          >
            <View style={styles.categoryHeader}>
              <View style={styles.categoryHeaderLine} />
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <View style={styles.categoryHeaderLine} />
            </View>
            <View style={styles.skillsGrid}>
              {category.items.map((item, itemIndex) => (
                <View key={item.name} style={styles.skillChip}>
                  {item.icon ? (
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={C.accent}
                      style={styles.skillChipIcon}
                    />
                  ) : null}
                  <Text style={styles.skillChipText}>{item.name}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* Footer */}
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION).delay(
            STAGGER_DELAY * 3 + skillCategories.length * STAGGER_DELAY
          )}
          style={styles.footer}
        >
          <View style={styles.footerLine} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backToPortfolio}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to portfolio"
          >
            <Ionicons name="home-outline" size={18} color={C.accent} />
            <Text style={styles.backToPortfolioText}>Back to portfolio</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
