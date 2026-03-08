import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/error-message";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  deleteGrosirDraft,
  getGrosirDrafts
} from "@/edysonpos/services/database";
import type { GrosirDraft } from "@/edysonpos/types/database";
import { formatIDR } from "@/utils/currency";
import { formatDateTimeIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export default function GrosirSavedScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { profile } = useAuth();

  const [drafts, setDrafts] = useState<GrosirDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrafts = useCallback(async () => {
    try {
      // Load ALL saved drafts so multiple users can collaborate.
      // Note: Neon Data API uses the authenticated role; ensure RLS or schema grants allow SELECT on grosirDrafts for your app.
      const list = await getGrosirDrafts();
      setDrafts(list);
    } catch (e) {
      console.error("Error loading grosir drafts:", e);
      Alert.alert("Error", "Failed to load saved transactions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  React.useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const handleContinue = (draft: GrosirDraft) => {
    router.push(`/sales/grosir?draft=${draft.id}`);
  };

  const performDelete = async (draft: GrosirDraft) => {
    try {
      await deleteGrosirDraft(draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (e) {
      console.error("Error deleting draft:", e);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Failed to delete saved transaction.");
      } else {
        Alert.alert("Error", "Failed to delete saved transaction.");
      }
    }
  };

  const handleDelete = (draft: GrosirDraft) => {
    const message = `Remove "${draft.namaPelanggan || "Draft"}" (${formatIDR(draft.totalBelanja)})?`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        performDelete(draft);
      }
    } else {
      Alert.alert("Delete saved transaction", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => performDelete(draft) },
      ]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.icon + "20" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.text }]}>
          Saved transactions
        </ThemedText>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {drafts.length === 0 ? (
            <EmptyState
              title="No saved transactions"
              message="Save a grosir transaction from the wholesale sale screen to continue later."
            />
          ) : (
            drafts.map((draft) => (
              <Card key={draft.id} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.cardTouchable}>
                  <View style={styles.cardMain}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.customerName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {draft.namaPelanggan || "No customer name"}
                    </ThemedText>
                    <ThemedText style={[styles.meta, { color: colors.icon }]}>
                      {formatIDR(draft.totalBelanja)}
                      {draft.setorAwal > 0
                        ? ` · Paid ${formatIDR(draft.setorAwal)}`
                        : ""}
                    </ThemedText>
                    <ThemedText style={[styles.date, { color: colors.icon }]}>
                      {formatDateTimeIndo(draft.updated_at)}
                    </ThemedText>
                    {draft.createdBy ? (
                      <ThemedText style={[styles.owner, { color: colors.icon }]}>
                        Saved by {draft.createdBy === profile?.id ? "you" : draft.createdBy}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => handleContinue(draft)}
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play-outline" size={20} color="#FFF" />
                      <ThemedText style={styles.actionBtnText}>Continue</ThemedText>
                    </TouchableOpacity>
                    {(draft.createdBy === profile?.id ||
                      profile?.role === "admin" ||
                      profile?.role === "manager") && (
                      <View style={styles.deleteButtonWrapper}>
                        <TouchableOpacity
                          onPress={() => handleDelete(draft)}
                          style={[styles.actionBtn, { backgroundColor: colors.error + "20" }]}
                          activeOpacity={0.7}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                          <ThemedText style={[styles.actionBtnText, { color: colors.error }]}>
                            Delete
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 12,
  },
  cardTouchable: {
    padding: 4,
  },
  cardMain: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
  },
  meta: {
    fontSize: 13,
    marginTop: 4,
  },
  date: {
    fontSize: 11,
    marginTop: 4,
  },
  owner: {
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    zIndex: 1,
    minHeight: 44,
  },
  deleteButtonWrapper: {
    pointerEvents: "auto" as const,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 40,
    zIndex: 2,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
