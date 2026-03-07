import { usePortfolioTheme } from "@/portfolio/context/PortfolioThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Switch, View, StyleSheet } from "react-native";

export function PortfolioThemeToggle() {
  const { mode, toggleMode, colors, isDark } = usePortfolioTheme();

  return (
    <View style={styles.wrap}>
      <Ionicons
        name="moon-outline"
        size={18}
        color={isDark ? colors.accent : colors.textSoft}
      />
      <Switch
        value={!isDark}
        onValueChange={toggleMode}
        trackColor={{
          false: colors.border,
          true: colors.accentDim,
        }}
        thumbColor={isDark ? colors.accent : colors.white}
        accessibilityLabel="Toggle portfolio theme: dark or light"
        accessibilityRole="switch"
      />
      <Ionicons
        name="sunny-outline"
        size={18}
        color={!isDark ? colors.accent : colors.textSoft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
