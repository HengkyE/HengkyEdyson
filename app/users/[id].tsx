import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { getUserProfile, getJualanKontanByDateRange, getJualanGrosirByDateRange } from "@/edysonpos/services/database";
import type { JualanGrosir, JualanKontan, UserProfile } from "@/edysonpos/types/database";
import { formatIDR } from "@/utils/currency";
import { formatDateIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type Transaction = (JualanKontan & { type: "kontan" }) | (JualanGrosir & { type: "grosir" });

export default function UserDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { canManageUsers } = usePermissions();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    if (!canManageUsers) {
      Alert.alert("Access Denied", "You do not have permission to view user details.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    if (id) {
      loadUser();
      loadUserTransactions();
    }
  }, [id, canManageUsers]);

  const loadUser = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getUserProfile(id);
      if (!data) {
        Alert.alert("Error", "User not found", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setUser(data);
    } catch (err: any) {
      console.error("Error loading user:", err);
      Alert.alert("Error", "Failed to load user", [{ text: "OK", onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserTransactions = async () => {
    if (!id) return;
    try {
      setLoadingTransactions(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const [kontanSales, grosirSales] = await Promise.all([
        getJualanKontanByDateRange(startDate, endDate, id),
        getJualanGrosirByDateRange(startDate, endDate, id),
      ]);

      const kontanTransactions: Transaction[] = kontanSales.map((sale) => ({
        ...sale,
        type: "kontan" as const,
      }));

      const grosirTransactions: Transaction[] = grosirSales.map((sale) => ({
        ...sale,
        type: "grosir" as const,
      }));

      setTransactions([...kontanTransactions, ...grosirTransactions].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      }));
    } catch (err: any) {
      console.error("Error loading transactions:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return colors.error;
      case "manager":
        return colors.warning;
      case "cashier":
        return colors.primary;
      default:
        return colors.icon;
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={{ color: colors.icon, marginTop: 12 }}>Loading user...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          User Details
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* User Info Card */}
        <Card style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) + "20" }]}>
            <Ionicons name="person" size={48} color={getRoleColor(user.role)} />
          </View>
          <View style={styles.userInfo}>
            <ThemedText type="title" style={{ color: colors.text, textAlign: "center" }}>
              {user.fullName}
            </ThemedText>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: getRoleColor(user.role) + "20" },
              ]}
            >
              <ThemedText style={[styles.roleBadgeText, { color: getRoleColor(user.role) }]}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.userEmail, { color: colors.icon, textAlign: "center" }]}>
              {user.email}
            </ThemedText>
            {user.phone && (
              <ThemedText style={[styles.userPhone, { color: colors.icon, textAlign: "center" }]}>
                {user.phone}
              </ThemedText>
            )}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: user.isActive ? colors.success + "20" : colors.error + "20",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.statusText,
                  {
                    color: user.isActive ? colors.success : colors.error,
                  },
                ]}
              >
                {user.isActive ? "Active" : "Inactive"}
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Transaction History */}
        <Card style={styles.transactionsCard}>
          <ThemedText type="subtitle" style={{ color: colors.text, marginBottom: 12 }}>
            Recent Transactions (Last 30 Days)
          </ThemedText>
          {loadingTransactions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <ThemedText style={{ color: colors.icon, marginTop: 8 }}>Loading transactions...</ThemedText>
            </View>
          ) : transactions.length === 0 ? (
            <ThemedText style={{ color: colors.icon, textAlign: "center" }}>
              No transactions found
            </ThemedText>
          ) : (
            transactions.slice(0, 10).map((transaction) => (
              <View
                key={transaction.id}
                style={[
                  styles.transactionRow,
                  {
                    borderBottomColor: colors.icon + "20",
                  },
                ]}
              >
                <View style={styles.transactionInfo}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                    {transaction.type === "kontan" ? "Cash Sale" : "Wholesale Sale"}
                  </ThemedText>
                  <ThemedText style={[styles.transactionDate, { color: colors.icon }]}>
                    {formatDateIndo(new Date(transaction.created_at))}
                  </ThemedText>
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                  {formatIDR(
                    transaction.type === "kontan"
                      ? Number(transaction.totalBelanja)
                      : transaction.totalBelanja
                  )}
                </ThemedText>
              </View>
            ))
          )}
        </Card>
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
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  userCard: {
    marginBottom: 16,
    padding: 20,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userInfo: {
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  userPhone: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  transactionsCard: {
    marginBottom: 16,
    padding: 16,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 12,
    marginTop: 4,
  },
});

