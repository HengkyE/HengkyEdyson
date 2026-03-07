import { profile, projects } from "@/portfolio/constants/portfolio";
import type { PortfolioThemeColors } from "@/portfolio/constants/portfolio-theme";
import { usePortfolioTheme } from "@/portfolio/context/PortfolioThemeContext";
import { PortfolioThemeToggle } from "@/portfolio/components/portfolio-theme-toggle";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState, useMemo } from "react";
import {
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";

const ANIMATION_DURATION = 420;
const STAGGER_DELAY = 80;

function createStyles(C: PortfolioThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    gridContainer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" as const },
    gridLineH: { position: "absolute" as const, left: 0, right: 0, height: 1, backgroundColor: C.border, opacity: 0.12 },
    gridLineV: { position: "absolute" as const, top: 0, bottom: 0, width: 1, backgroundColor: C.border, opacity: 0.08 },
    gradientOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 360,
      backgroundColor:
        Platform.OS === "web"
          ? C.background === "#f8fafc"
            ? "rgba(14, 165, 233, 0.04)"
            : "rgba(34, 211, 238, 0.03)"
          : "transparent",
    },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 80 },
    headerBar: {
      flexDirection: "row" as const,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: Platform.OS === "web" ? 28 : 52,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerRightRow: { flexDirection: "row" as const, alignItems: "center", gap: 12 },
    skillsLink: { flexDirection: "row" as const, alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
    skillsLinkText: { fontSize: 14, fontWeight: "600" as const, color: C.accent, letterSpacing: 0.5 },
    headerTitle: { fontSize: 15, fontWeight: "600" as const, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase" as const },
    openAppButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.accent,
      backgroundColor: C.accentDim,
    },
    openAppButtonText: { color: C.accent, fontSize: 14, fontWeight: "600" as const, letterSpacing: 0.5 },
    profileSection: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 32, alignItems: "center" },
    nameWrap: { alignItems: "center", marginBottom: 8 },
    profileName: { fontSize: 32, fontWeight: "700" as const, color: C.text, letterSpacing: 0.5, textAlign: "center" as const },
    nameUnderline: { width: 48, height: 3, borderRadius: 2, backgroundColor: C.accent, marginTop: 10, opacity: 0.9 },
    tagline: { fontSize: 15, color: C.accent, letterSpacing: 0.5, textAlign: "center" as const, marginBottom: 16, fontWeight: "500" as const },
    bio: { fontSize: 15, lineHeight: 24, color: C.textMuted, textAlign: "center" as const, maxWidth: 480 },
    resumeLink: {
      flexDirection: "row" as const,
      alignItems: "center",
      gap: 10,
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderBright,
      backgroundColor: C.accentDim,
    },
    resumeLinkText: { fontSize: 15, fontWeight: "600" as const, color: C.accent },
    contactRow: { flexDirection: "row" as const, gap: 20, marginTop: 24 },
    contactIcon: { padding: 8 },
    skillsCardWrap: { paddingHorizontal: 28, marginBottom: 8, maxWidth: 540, alignSelf: "center" as const, width: "100%" },
    skillsCard: {
      borderRadius: 16,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceCard,
      position: "relative" as const,
    },
    skillsCardGlow: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 1, backgroundColor: C.accentGlow, opacity: 0.6 },
    skillsCardInner: { flexDirection: "row" as const, alignItems: "center", padding: 20, gap: 16 },
    skillsCardIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentDim,
      borderWidth: 1,
      borderColor: C.border,
    },
    skillsCardText: { flex: 1 },
    skillsCardTitle: { fontSize: 17, fontWeight: "700" as const, color: C.text, marginBottom: 4, letterSpacing: 0.2 },
    skillsCardDescription: { fontSize: 13, lineHeight: 20, color: C.textMuted },
    sectionDivider: { flexDirection: "row" as const, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 28, marginBottom: 28 },
    sectionDividerLine: { flex: 1, height: 1, backgroundColor: C.border, opacity: 0.6 },
    sectionDividerLabel: { fontSize: 11, fontWeight: "600" as const, color: C.textSoft, letterSpacing: 2.5, textTransform: "uppercase" as const },
    projectsSection: { paddingHorizontal: 28 },
    projectsGrid: { gap: 20, maxWidth: 540, alignSelf: "center" as const, width: "100%" },
    projectCardWrap: { width: "100%" },
    projectCard: {
      borderRadius: 16,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceCard,
      position: "relative" as const,
    },
    projectCardGlow: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 1, backgroundColor: C.accentGlow, opacity: 0.6 },
    projectCardInner: { padding: 22 },
    projectCardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentDim,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    projectCardTitle: { fontSize: 18, fontWeight: "700" as const, color: C.text, marginBottom: 6, letterSpacing: 0.3 },
    projectCardDescription: { fontSize: 14, lineHeight: 21, color: C.textMuted, marginBottom: 14 },
    projectCardFooter: { flexDirection: "row" as const, alignItems: "center", gap: 6 },
    projectCardLink: { fontSize: 14, fontWeight: "600" as const, color: C.accent, letterSpacing: 0.3 },
    footer: { alignItems: "center", paddingTop: 48, paddingHorizontal: 28 },
    footerLine: { width: 60, height: 1, backgroundColor: C.border, marginBottom: 16, opacity: 0.5 },
    footerText: { fontSize: 12, color: C.textSoft, letterSpacing: 0.5 },
    scrollTopWrap: { position: "absolute" as const, bottom: 28, right: 24 },
    scrollTopButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.surfaceCard,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}

export default function PortfolioScreen() {
  const router = useRouter();
  const { colors: C, isDark } = usePortfolioTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowScrollTop(y > 400);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Background grid */}
      <View style={styles.gridContainer} pointerEvents="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={`h-${i}`}
            style={[styles.gridLineH, { top: `${20 + i * 20}%` }]}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={`v-${i}`}
            style={[styles.gridLineV, { left: `${15 + i * 20}%` }]}
          />
        ))}
      </View>
      <View style={styles.gradientOverlay} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION)}
          style={styles.headerBar}
        >
          <TouchableOpacity
            onPress={() => router.push("/skills")}
            style={styles.skillsLink}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View skills"
          >
            <Ionicons name="bulb-outline" size={20} color={C.accent} />
            <Text style={styles.skillsLinkText}>Skills</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Portfolio</Text>
          <View style={styles.headerRightRow}>
            <PortfolioThemeToggle />
            <TouchableOpacity
              onPress={() => router.push("/login")}
              style={styles.openAppButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open app"
            >
              <Text style={styles.openAppButtonText}>Open app</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Profile */}
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATION).delay(STAGGER_DELAY)}
          style={styles.profileSection}
        >
          <View style={styles.nameWrap}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <View style={styles.nameUnderline} />
          </View>
          <Text style={styles.tagline}>{profile.tagline}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
          {profile.resumeUrl && profile.resumeUrl !== "#" && (
            <TouchableOpacity
              onPress={() => Linking.openURL(profile.resumeUrl)}
              style={styles.resumeLink}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Open resume"
            >
              <Ionicons name="document-text-outline" size={20} color={C.accent} />
              <Text style={styles.resumeLinkText}>Resume</Text>
            </TouchableOpacity>
          )}
          {(profile.email || profile.github || profile.linkedin) && (
            <View style={styles.contactRow}>
              {profile.email && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`mailto:${profile.email}`)}
                  style={styles.contactIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Send email"
                >
                  <Ionicons name="mail-outline" size={24} color={C.accent} />
                </TouchableOpacity>
              )}
              {profile.github && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(profile.github)}
                  style={styles.contactIcon}
                  accessibilityRole="link"
                  accessibilityLabel="Open GitHub profile"
                >
                  <Ionicons name="logo-github" size={24} color={C.accent} />
                </TouchableOpacity>
              )}
              {profile.linkedin && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(profile.linkedin)}
                  style={styles.contactIcon}
                  accessibilityRole="link"
                  accessibilityLabel="Open LinkedIn profile"
                >
                  <Ionicons name="logo-linkedin" size={24} color={C.accent} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* Skills card */}
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 2)}
          style={styles.skillsCardWrap}
        >
          <TouchableOpacity
            onPress={() => router.push("/skills")}
            style={styles.skillsCard}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View skills and what I can do"
          >
            <View style={styles.skillsCardGlow} />
            <View style={styles.skillsCardInner}>
              <View style={styles.skillsCardIcon}>
                <Ionicons name="bulb-outline" size={28} color={C.accent} />
              </View>
              <View style={styles.skillsCardText}>
                <Text style={styles.skillsCardTitle}>Skills & what I can do</Text>
                <Text style={styles.skillsCardDescription}>
                  Technologies and tools I use to build products — from frontend and mobile to backend and deployment.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.accent} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Section divider: Projects */}
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION).delay(STAGGER_DELAY * 3)}
          style={styles.sectionDivider}
        >
          <View style={styles.sectionDividerLine} />
          <Text style={styles.sectionDividerLabel}>Projects</Text>
          <View style={styles.sectionDividerLine} />
        </Animated.View>

        {/* Projects */}
        <View style={styles.projectsSection}>
          <View style={styles.projectsGrid}>
            {projects.map((project, index) => (
              <Animated.View
                key={project.id}
                entering={FadeInDown.duration(ANIMATION_DURATION).delay(
                  STAGGER_DELAY * 4 + index * STAGGER_DELAY
                )}
                style={styles.projectCardWrap}
              >
                <TouchableOpacity
                  onPress={() => router.push(project.route as any)}
                  style={styles.projectCard}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`View project ${project.title}`}
                  accessibilityHint="Opens project details"
                >
                  <View style={styles.projectCardGlow} />
                  <View style={styles.projectCardInner}>
                    <View style={styles.projectCardIcon}>
                      <Ionicons
                        name="folder-open-outline"
                        size={26}
                        color={C.accent}
                      />
                    </View>
                    <Text style={styles.projectCardTitle}>{project.title}</Text>
                    <Text
                      style={styles.projectCardDescription}
                      numberOfLines={3}
                    >
                      {project.shortDescription}
                    </Text>
                    <View style={styles.projectCardFooter}>
                      <Text style={styles.projectCardLink}>View project</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={C.accent}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION).delay(
            STAGGER_DELAY * 5 + projects.length * STAGGER_DELAY
          )}
          style={styles.footer}
        >
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>
            Built with Expo · React Native · TypeScript
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Scroll to top FAB */}
      {showScrollTop && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.scrollTopWrap}
        >
          <TouchableOpacity
            onPress={scrollToTop}
            style={styles.scrollTopButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Scroll to top"
          >
            <Ionicons name="chevron-up" size={24} color={C.accent} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
