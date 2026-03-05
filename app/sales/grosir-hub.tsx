import { QuickActionCard } from "@/components/quick-action-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

export default function GrosirHubScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.icon + "20" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.text }]}>
          {t("home.grosirOnly")}
        </ThemedText>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          {t("grosirHub.chooseOption")}
        </ThemedText>
        <View style={styles.grid}>
          <QuickActionCard
            title={t("grosirHub.menu")}
            description={t("grosirHub.newWholesaleSale")}
            icon="cart-outline"
            iconColor={colors.primary}
            onPress={() => router.push("/sales/grosir")}
          />
          <QuickActionCard
            title={t("grosirHub.managePayment")}
            description={t("grosirHub.invoicesAndPayments")}
            icon="card-outline"
            iconColor={colors.accent}
            onPress={() => router.push("/sales/grosir-invoices")}
          />
          <QuickActionCard
            title={t("grosirHub.reviewTransactions")}
            description={t("grosirHub.viewGrosirSales")}
            icon="document-text-outline"
            iconColor={colors.accent}
            onPress={() => router.push("/transactions?filter=grosir")}
          />
          <QuickActionCard
            title={t("grosirHub.savedTransactions")}
            description={t("grosirHub.continueSavedDrafts")}
            icon="folder-open-outline"
            iconColor={colors.accent}
            onPress={() => router.push("/sales/grosir-saved")}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
