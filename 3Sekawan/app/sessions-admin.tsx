import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import type { Database } from "@/lib/database.types";
import { getBilliardSessions, updateBilliardSession } from "@/services/billiardAndExpenses";
import { formatIDR } from "@/utils/currency";
import { formatDateTimeIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionStatus = "active" | "timer_ended" | "paid";

const STATUS_OPTIONS: SessionStatus[] = ["active", "timer_ended", "paid"];

function getStatusColor(status: string, colors: typeof Colors.light): string {
  if (status === "paid") return colors.success;
  if (status === "timer_ended") return colors.warning;
  return colors.primary;
}

function getEstimatedEnd(startedAt: string, hours: number): Date {
  return new Date(new Date(startedAt).getTime() + hours * 3_600_000);
}

export default function SessionsAdminScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAdmin } = usePermissions();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getBilliardSessions();
      const sorted = (data ?? [])
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 250);
      setSessions(sorted as SessionRow[]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Gagal memuat daftar sesi.");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert("Access denied", "Hanya admin yang boleh akses halaman ini.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    (async () => {
      setLoading(true);
      await loadSessions();
      setLoading(false);
    })();
  }, [isAdmin, loadSessions, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const orderedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const aProblem = a.status === "timer_ended" ? 1 : 0;
        const bProblem = b.status === "timer_ended" ? 1 : 0;
        if (aProblem !== bProblem) return bProblem - aProblem;
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      }),
    [sessions]
  );

  const updateStatus = async (session: SessionRow, nextStatus: SessionStatus) => {
    if (updatingId) return;
    setUpdatingId(session.id);
    try {
      // Admin recovery action must not alter session timestamps.
      // We only patch status so started_at / paid_at stay exactly as recorded.
      const updates: Partial<SessionRow> = {
        status: nextStatus,
        started_at: session.started_at,
        paid_at: session.paid_at,
      };
      await updateBilliardSession(session.id, { status: nextStatus });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? ({ ...s, ...updates } as SessionRow) : s))
      );
    } catch (err: any) {
      Alert.alert("Gagal update status", err?.message || "Silakan coba lagi.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.headerTitle}>
            Session Recovery
          </ThemedText>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingWrap}>
          <SkeletonList count={6} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Session Recovery
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.infoCard}>
          <ThemedText style={{ color: colors.text }}>
            Halaman khusus admin untuk cek semua sesi dan perbaiki status yang salah (misalnya masih{" "}
            <ThemedText style={{ color: colors.warning }}>"timer_ended"</ThemedText> padahal sudah bayar).
          </ThemedText>
        </Card>

        {orderedSessions.map((session) => {
          const hours = Number(session.duration_hours || 0);
          const amount = Number(session.rate_per_hour || 0) * hours;
          const endAt = getEstimatedEnd(session.started_at, hours);
          const statusColor = getStatusColor(session.status, colors);
          const isUpdating = updatingId === session.id;

          return (
            <Card key={session.id} style={styles.card}>
              <View style={styles.rowTop}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                  Meja {session.table_number}
                </ThemedText>
                <View style={[styles.badge, { backgroundColor: statusColor + "20" }]}>
                  <ThemedText style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>
                    {session.status}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={[styles.meta, { color: colors.icon }]}>
                Mulai: {formatDateTimeIndo(session.started_at)}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: colors.icon }]}>
                Selesai (estimasi): {formatDateTimeIndo(endAt)}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: colors.icon }]}>
                Paid at: {session.paid_at ? formatDateTimeIndo(session.paid_at) : "-"}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: colors.text }]}>
                Durasi {hours.toFixed(1)} jam • Tarif {formatIDR(Number(session.rate_per_hour || 0))} • Total{" "}
                {formatIDR(amount)}
              </ThemedText>

              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = session.status === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => updateStatus(session, opt)}
                      disabled={isUpdating}
                      style={[
                        styles.statusButton,
                        {
                          borderColor: active ? statusColor : colors.icon + "40",
                          backgroundColor: active ? statusColor + "20" : colors.background,
                          opacity: isUpdating ? 0.6 : 1,
                        },
                      ]}
                    >
                      <ThemedText style={{ color: active ? statusColor : colors.text, fontSize: 12 }}>
                        {opt}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {isUpdating && (
                <View style={styles.updatingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <ThemedText style={{ color: colors.icon, fontSize: 12 }}>Updating status...</ThemedText>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 60,
  },
  backButton: { padding: 8, width: 40 },
  headerTitle: { fontSize: 24 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingWrap: { padding: 16 },
  infoCard: { marginBottom: 12, padding: 12 },
  card: { marginBottom: 10, padding: 12 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  meta: { fontSize: 13, marginBottom: 4 },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  statusButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  updatingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
});
