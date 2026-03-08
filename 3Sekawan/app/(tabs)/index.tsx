import { LanguageToggle } from "@/components/language-toggle";
import { QuickActionCard } from "@/components/quick-action-card";
import { SalesCard } from "@/components/sales-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { useBasePath } from "@/hooks/useBasePath";
import type { Database } from "@/lib/database.types";
import { getBilliardSessions } from "@/services/billiardAndExpenses";
import { formatIDR } from "@/utils/currency";
import { getCurrentDateIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
const ALL_TABLES = Array.from({ length: 17 }, (_, i) => i + 1);

export default function HomeScreen() {
  const router = useRouter();
  const base = useBasePath();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { t } = useLanguage();

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [activeTables, setActiveTables] = useState(0);
  const [waitingPayment, setWaitingPayment] = useState(0);
  const [occupiedTables, setOccupiedTables] = useState(0);
  const [currentDate, setCurrentDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentDate(getCurrentDateIndo());
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const allSessions = await getBilliardSessions();
      const activeData = (allSessions ?? []).filter((s) =>
        ["active", "timer_ended"].includes(s.status)
      );

      const sessionByTable = activeData.reduce<Record<number, SessionRow>>(
        (acc, s) => {
          acc[s.table_number] = s as SessionRow;
          return acc;
        },
        {}
      );

      let activeCount = 0;
      let endedCount = 0;
      ALL_TABLES.forEach((table) => {
        const s = sessionByTable[table];
        if (!s) return;
        if (s.status === "timer_ended") endedCount += 1;
        else activeCount += 1;
      });

      setActiveTables(activeCount);
      setWaitingPayment(endedCount);
      setOccupiedTables(activeCount + endedCount);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const paidData = (allSessions ?? []).filter(
        (s) => s.status === "paid" && s.paid_at && s.paid_at >= start.toISOString()
      );

      const revenue =
        paidData.reduce((sum, s) => {
          const row = s as SessionRow;
          return sum + Number(row.rate_per_hour) * Number(row.duration_hours || 0);
        }, 0) ?? 0;

      setTodayRevenue(revenue);
    } catch (error) {
      console.error("Error loading billiard dashboard data:", error);
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
            onPress={() => router.push(`${base}/(tabs)/settings`)}
            style={styles.menuBarButton}
            accessibilityLabel="Open menu / Settings"
          >
            <Ionicons name="menu" size={26} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" style={[styles.menuBarTitle, { color: colors.text }]}>
            TigaSekawan Billiard
          </ThemedText>
          <LanguageToggle />
        </View>

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="title" style={styles.welcomeText}>
              Selamat Datang Kembali, {user?.email?.split("@")[0] || "Kasir"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.systemTitle, { color: colors.text }]}>
            TigaSekawan Billiard
          </ThemedText>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color={colors.icon} />
            <ThemedText style={[styles.dateText, { color: colors.text }]}>{currentDate}</ThemedText>
          </View>
        </View>

        {/* Billiard status section */}
        <View style={styles.quickActionsSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            Status Meja Billiard
          </ThemedText>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              title="Meja Aktif"
              description="Jumlah meja sedang dipakai"
              icon="play-circle-outline"
              iconColor="#55EFC4"
              onPress={() => router.push(`${base}/(tabs)/billiard`)}
              badgeValue={`${occupiedTables}/${ALL_TABLES.length}`}
            />
            <QuickActionCard
              title="Butuh Pembayaran"
              description="Meja yang waktunya sudah habis"
              icon="alert-circle-outline"
              iconColor="#FF7675"
              onPress={() => router.push(`${base}/(tabs)/billiard`)}
              badgeValue={`${waitingPayment}`}
            />
          </View>
        </View>

        {/* Revenue overview section */}
        <View style={styles.salesSection}>
          <SalesCard
            title="Pendapatan Billiard Hari Ini"
            value={formatIDR(todayRevenue)}
            subtitle="Total dari meja yang sudah dibayar"
            icon="cash-outline"
            iconColor={colors.primaryLight}
            valueColor={colors.primary}
          />
          <SalesCard
            title="Perkiraan Jam Main"
            value={
              todayRevenue > 0
                ? `${Math.round(todayRevenue / 30000)} jam+`
                : "Belum ada sesi"
            }
            subtitle="Estimasi berdasarkan tarif rata‑rata"
            icon="time-outline"
            iconColor={colors.secondary + "80"}
            valueColor={colors.secondary}
          />
        </View>

        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            Aksi Cepat
          </ThemedText>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              title="Pengeluaran Toko"
              description="Catat pengeluaran harian toko"
              icon="wallet-outline"
              iconColor={colors.accent}
              onPress={() => router.push(`${base}/(tabs)/expenses`)}
            />
            <QuickActionCard
              title="Ringkasan Penjualan"
              description="Laporan pendapatan billiard"
              icon="document-text-outline"
              iconColor={colors.accent}
              onPress={() => router.push(`${base}/(tabs)/sales`)}
            />
          </View>
        </View>

        {isAdmin && (
          <View style={styles.quickActionsSection}>
            <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
              Admin Tools
            </ThemedText>
            <View style={styles.quickActionsGrid}>
              <QuickActionCard
                title="Perbaiki Status Sesi"
                description="Lihat semua sesi dan ubah status bermasalah"
                icon="build-outline"
                iconColor={colors.warning}
                onPress={() => router.push(`${base}/sessions-admin`)}
              />
            </View>
          </View>
        )}
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
