import { LanguageToggle } from "@/components/language-toggle";
import { QuickActionCard } from "@/components/quick-action-card";
import { SalesCard } from "@/components/sales-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getJualanGrosirToday, getJualanKontanToday } from "@/services/database";
import { formatIDR } from "@/utils/currency";
import { getCurrentDateIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user } = useAuth();
  const { t } = useLanguage();

  const [todaySales, setTodaySales] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [averageOrder, setAverageOrder] = useState(0);
  const [currentDate, setCurrentDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentDate(getCurrentDateIndo());
    loadSalesData();
  }, []);

  const loadSalesData = async () => {
    try {
      setLoading(true);
      const [kontanSales, grosirSales] = await Promise.all([
        getJualanKontanToday(),
        getJualanGrosirToday(),
      ]);

      const totalKontan = kontanSales.reduce((sum, sale) => sum + Number(sale.totalBelanja), 0);
      const totalGrosir = grosirSales.reduce((sum, sale) => sum + sale.totalBelanja, 0);
      const totalSales = totalKontan + totalGrosir;
      const totalTransactions = kontanSales.length + grosirSales.length;
      const average = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      setTodaySales(totalSales);
      setTodayTransactions(totalTransactions);
      setAverageOrder(average);
    } catch (error) {
      console.error("Error loading sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu bar */}
        <View style={[styles.menuBar, { borderBottomColor: colors.icon + "20" }]}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.menuBarButton}
            accessibilityLabel="Open menu / Settings"
          >
            <Ionicons name="menu" size={26} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" style={[styles.menuBarTitle, { color: colors.text }]}>
            {t("home.appName")}
          </ThemedText>
          <LanguageToggle />
        </View>

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="title" style={styles.welcomeText}>
              {t("home.welcome")}, {user?.email?.split("@")[0] || "User"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.systemTitle, { color: colors.text }]}>
            {t("home.appName")}
          </ThemedText>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color={colors.icon} />
            <ThemedText style={[styles.dateText, { color: colors.text }]}>{currentDate}</ThemedText>
          </View>
        </View>

        {/* Sales Types Section - Moved to first */}
        <View style={styles.quickActionsSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            {t("home.salesTypes")}
          </ThemedText>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              title={t("home.cashSale")}
              description={t("home.cashSale")}
              imageSource={require("@/assets/images/buying.png")}
              onPress={() => router.push("/sales/new")}
            />
            <QuickActionCard
              title={t("home.wholesaleSale")}
              description={t("home.wholesaleSale")}
              imageSource={require("@/assets/images/trade.svg")}
              onPress={() => router.push("/sales/grosir")}
            />
          </View>
        </View>

        {/* Sales Overview Section */}
        <View style={styles.salesSection}>
          <SalesCard
            title={t("home.salesToday")}
            value={formatIDR(todaySales)}
            subtitle={`${todayTransactions} ${t("home.transactions")}`}
            icon="cash-outline"
            iconColor={colors.primaryLight}
            valueColor={colors.primary}
          />
          <SalesCard
            title={t("home.averageOrder")}
            value={formatIDR(averageOrder)}
            subtitle={t("home.perTransactionToday")}
            icon="trending-up-outline"
            iconColor={colors.secondary + "80"}
            valueColor={colors.secondary}
          />
        </View>

        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            {t("home.quickActions")}
          </ThemedText>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              title={t("home.salesOverview")}
              description={t("home.salesOverviewDesc")}
              icon="stats-chart-outline"
              iconColor={colors.accent}
              onPress={() => router.push("/sales/overview")}
            />
            <QuickActionCard
              title={t("home.allTransactions")}
              description={t("home.allTransactionsDesc")}
              icon="document-text-outline"
              iconColor={colors.accent}
              onPress={() => router.push("/transactions")}
            />
            <QuickActionCard
              title={t("home.grosirOnly")}
              description={t("home.grosirOnlyDesc")}
              icon="receipt-outline"
              iconColor={colors.accent}
              onPress={() => router.push("/sales/grosir-hub")}
            />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  menuBarButton: {
    padding: 8,
  },
  menuBarTitle: {
    fontSize: 18,
  },
  menuBarPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  systemTitle: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    opacity: 0.7,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 14,
  },
  salesSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  quickActionsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
