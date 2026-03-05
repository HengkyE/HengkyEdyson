import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

const FLAG_EN = require("@/assets/images/flag-en.png");
const FLAG_ID = require("@/assets/images/flag-id.png");

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const activeBorder = colors.primary;
  const inactiveBorder = "transparent";

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.icon + "25",
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.flagButton,
          { borderColor: language === "en" ? activeBorder : inactiveBorder },
        ]}
        onPress={() => setLanguage("en")}
        activeOpacity={0.8}
        accessibilityLabel="Switch to English"
      >
        <Image source={FLAG_EN} style={styles.flagImage} resizeMode="cover" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.flagButton,
          { borderColor: language === "id" ? activeBorder : inactiveBorder },
        ]}
        onPress={() => setLanguage("id")}
        activeOpacity={0.8}
        accessibilityLabel="Switch to Indonesian"
      >
        <Image source={FLAG_ID} style={styles.flagImage} resizeMode="cover" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  flagButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
  },
  flagImage: {
    width: "100%",
    height: "100%",
  },
});
