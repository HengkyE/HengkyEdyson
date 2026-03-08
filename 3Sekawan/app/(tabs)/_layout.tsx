import { Tabs } from "expo-router";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home.home"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="billiard"
        options={{
          title: "Billiard",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          href: null, // Hide from tab bar but keep route accessible
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          href: null, // Hide from tab bar but keep route accessible
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("home.settings"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
