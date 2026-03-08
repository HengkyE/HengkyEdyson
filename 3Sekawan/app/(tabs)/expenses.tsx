import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CalculatorModal } from "@/edysonpos/components/calculator-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Database } from "@/lib/database.types";
import { deleteShopExpense, getShopExpenses, insertShopExpense } from "@/services/billiardAndExpenses";
import { thermalPrinter } from "@/services/thermal-printer";
import { formatIDR } from "@/utils/currency";
import { formatDateTimeIndo } from "@/utils/date";
import { useRouter } from "expo-router";

type ExpenseRow = Database["public"]["Tables"]["shop_expenses"]["Row"];

const EXPENSE_CATEGORIES = [
  { id: "cleaning", label: "Kebersihan" },
  { id: "wages", label: "Gaji Karyawan" },
  { id: "utilities", label: "Listrik / Air" },
  { id: "supplies", label: "Perlengkapan" },
  { id: "maintenance", label: "Perbaikan" },
  { id: "billiard", label: "Billiard" },
  { id: "other", label: "Lainnya" },
];

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ExpensesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, profile } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [startDate, setStartDate] = useState(() => new Date(today));
  const [endDate, setEndDate] = useState(() => new Date(today));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addCategory, setAddCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [addDescription, setAddDescription] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addExpenseDate, setAddExpenseDate] = useState(toYYYYMMDD(today));
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [printingExpenses, setPrintingExpenses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDateStr = toYYYYMMDD(startDate);
  const endDateStr = toYYYYMMDD(endDate);

  useEffect(() => {
    loadExpenses();
  }, [startDateStr, endDateStr]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure start <= end
      const [from, to] =
        startDateStr <= endDateStr ? [startDateStr, endDateStr] : [endDateStr, startDateStr];

      const data = await getShopExpenses();
      const filtered = (data ?? [])
        .filter((e) => e.expense_date >= from && e.expense_date <= to)
        .sort(
          (a, b) =>
            new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime() ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setExpenses(filtered as ExpenseRow[]);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data";
      setError(msg);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [expenses]
  );

  const handleAddExpense = async () => {
    const amount = parseInt(addAmount.replace(/\D/g, ""), 10);
    if (!amount || amount <= 0) return;

    setSubmitting(true);
    try {
      await insertShopExpense({
        expense_date: addExpenseDate,
        category: addCategory,
        description: addDescription.trim() || null,
        amount,
        created_by: user?.id ?? null,
        notes: addNotes.trim() || null,
      });

      setShowAddModal(false);
      setAddCategory(EXPENSE_CATEGORIES[0].id);
      setAddDescription("");
      setAddAmount("");
      setAddNotes("");
      setAddExpenseDate(startDateStr);
      await loadExpenses();
    } catch (err: unknown) {
      console.error("Error adding expense:", err);
      setError(err instanceof Error ? err.message : "Gagal menambah pengeluaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteShopExpense(id);
      await loadExpenses();
    } catch (err: unknown) {
      console.error("Error deleting expense:", err);
    }
  };

  const getCategoryLabel = (id: string) =>
    EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  const handlePrintExpenses = async () => {
    setPrintingExpenses(true);
    try {
      if (!thermalPrinter.isConnected()) {
        Alert.alert(
          "Printer Tidak Terhubung",
          "Hubungkan printer Bluetooth di Pengaturan terlebih dahulu."
        );
        return;
      }
      await thermalPrinter.printExpensesSummaryReport({
        startDateLabel: formatDisplayDate(startDate),
        endDateLabel: formatDisplayDate(endDate),
        printedBy: profile?.fullName || user?.email?.split("@")[0] || "—",
        items: expenses.map((e) => ({
          category: getCategoryLabel(e.category),
          description: e.description,
          amount: Number(e.amount),
          date: e.expense_date,
        })),
        totalAmount: totalExpenses,
      });
      Alert.alert("Berhasil", "Laporan pengeluaran berhasil dicetak.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencetak";
      Alert.alert("Gagal Mencetak", msg);
    } finally {
      setPrintingExpenses(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            Pengeluaran Toko
          </ThemedText>
        </View>

        <Card>
          <View style={styles.filterHeader}>
            <ThemedText type="defaultSemiBold" style={[styles.filterTitle, { color: colors.text }]}>
              Rentang Tanggal
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.dateChip, { borderColor: colors.primary + "60" }]}
            onPress={() => {
              setStartDateInput(toYYYYMMDD(startDate));
              setEndDateInput(toYYYYMMDD(endDate));
              setShowDatePicker(true);
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <ThemedText style={[styles.dateChipText, { color: colors.text }]}>
              {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
            </ThemedText>
          </TouchableOpacity>
        </Card>

        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, { borderColor: colors.error + "40" }]}>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>
              Total Pengeluaran
            </ThemedText>
            <ThemedText type="title" style={[styles.summaryValue, { color: colors.error }]}>
              {formatIDR(totalExpenses)}
            </ThemedText>
          </Card>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.printButton, { borderColor: colors.primary, backgroundColor: colors.background }]}
            onPress={handlePrintExpenses}
            disabled={printingExpenses}
          >
            {printingExpenses ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="print-outline" size={20} color={colors.primary} />
            )}
            <ThemedText style={[styles.printButtonText, { color: colors.primary }]}>
              {printingExpenses ? "Mencetak…" : "Print Pengeluaran"}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setAddExpenseDate(startDateStr);
              setShowAddModal(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <ThemedText style={styles.addButtonText}>Tambah Pengeluaran</ThemedText>
          </TouchableOpacity>
        </View>

        <Card>
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
            Daftar Pengeluaran
          </ThemedText>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={20} color={colors.error} />
              <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={colors.icon} />
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                Belum ada pengeluaran untuk rentang tanggal ini.
              </ThemedText>
    </View>
          ) : (
            expenses.map((exp) => (
              <View key={exp.id} style={[styles.expenseRow, { borderTopColor: colors.icon + "20" }]}>
                <View style={styles.expenseLeft}>
                  <ThemedText type="defaultSemiBold" style={[styles.expenseCategory, { color: colors.text }]}>
                    {getCategoryLabel(exp.category)}
                  </ThemedText>
                  {exp.description && (
                    <ThemedText style={[styles.expenseDesc, { color: colors.icon }]}>
                      {exp.description}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.expenseMeta, { color: colors.icon }]}>
                    {formatDateTimeIndo(exp.created_at)}
                  </ThemedText>
                </View>
                <View style={styles.expenseRight}>
                  <ThemedText type="defaultSemiBold" style={[styles.expenseAmount, { color: colors.error }]}>
                    {formatIDR(exp.amount)}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => handleDeleteExpense(exp.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Add expense modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="title" style={styles.modalTitle}>
              Tambah Pengeluaran
            </ThemedText>

            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Tanggal</ThemedText>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={addExpenseDate}
                onChange={(e) => setAddExpenseDate((e.target as HTMLInputElement).value)}
                style={{
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${colors.icon}40`,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <TextInput
                style={[styles.input, { borderColor: colors.icon + "40", color: colors.text }]}
                value={addExpenseDate}
                onChangeText={setAddExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.icon}
              />
            )}

            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Jumlah (Rp)</ThemedText>
            <TouchableOpacity
              style={[styles.input, styles.amountInput, { borderColor: colors.icon + "40", backgroundColor: colors.background }]}
              onPress={() => setShowCalculatorModal(true)}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.amountInputText, { color: addAmount ? colors.text : colors.icon }]}>
                {addAmount ? formatIDR(parseInt(addAmount.replace(/\D/g, ""), 10) || 0) : "Ketuk untuk input jumlah"}
              </ThemedText>
              <Ionicons name="calculator-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <CalculatorModal
              visible={showCalculatorModal}
              initialValue={parseInt(addAmount.replace(/\D/g, ""), 10) || 0}
              onClose={() => setShowCalculatorModal(false)}
              onConfirm={(value) => {
                setAddAmount(String(value));
                setShowCalculatorModal(false);
              }}
              mode="price"
              productName="Jumlah Pengeluaran"
            />

            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Kategori</ThemedText>
            <TouchableOpacity
              style={[styles.input, styles.amountInput, { borderColor: colors.icon + "40", backgroundColor: colors.background, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.amountInputText, { color: colors.text }]}>
                {EXPENSE_CATEGORIES.find((c) => c.id === addCategory)?.label ?? addCategory}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </TouchableOpacity>

            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Deskripsi (opsional)</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.icon + "40", color: colors.text }]}
              value={addDescription}
              onChangeText={setAddDescription}
              placeholder="Contoh: Sabun pel pel, tissue"
              placeholderTextColor={colors.icon}
            />

            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Catatan (opsional)</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.icon + "40", color: colors.text }]}
              value={addNotes}
              onChangeText={setAddNotes}
              placeholder="Catatan tambahan"
              placeholderTextColor={colors.icon}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.icon }]}
                onPress={() => setShowAddModal(false)}
              >
                <ThemedText>Batal</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  { backgroundColor: colors.primary },
                  (submitting || !addAmount.trim()) && styles.disabled,
                ]}
                onPress={handleAddExpense}
                disabled={submitting || !addAmount.trim()}
              >
                <ThemedText style={styles.modalConfirmText}>
                  {submitting ? "Menyimpan…" : "Simpan"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Category picker modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <TouchableOpacity
            style={[styles.categoryPickerBox, { backgroundColor: colors.cardBackground }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.categoryPickerHeader, { borderBottomColor: colors.icon + "30" }]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>Pilih Kategori</ThemedText>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryPickerList} keyboardShouldPersistTaps="handled">
              {EXPENSE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.categoryPickerItem,
                    { borderBottomColor: colors.icon + "20" },
                    addCategory === c.id && { backgroundColor: colors.primary + "18" },
                  ]}
                  onPress={() => {
                    setAddCategory(c.id);
                    setShowCategoryModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={[
                      styles.categoryPickerItemText,
                      { color: addCategory === c.id ? colors.primary : colors.text },
                    ]}
                  >
                    {c.label}
                  </ThemedText>
                  {addCategory === c.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date range picker modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.datePickerOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.datePickerHeader}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Pilih rentang tanggal
              </ThemedText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Dari tanggal</ThemedText>
              {Platform.OS === "web" ? (
                <View style={styles.webDatePickerWrap}>
                  <input
                    type="date"
                    value={toYYYYMMDD(startDate)}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      if (v) {
                        const d = new Date(v);
                        if (!Number.isNaN(d.getTime())) {
                          d.setHours(0, 0, 0, 0);
                          setStartDate(d);
                          if (d > endDate) setEndDate(new Date(d));
                        }
                      }
                    }}
                    style={{
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 8,
                      border: `1px solid ${colors.icon}40`,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </View>
              ) : (
                <TextInput
                  style={[styles.dateInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon + "40" }]}
                  placeholder="YYYY-MM-DD"
                  value={startDateInput}
                  onChangeText={(text) => {
                    let formatted = text.replace(/[^0-9]/g, "");
                    if (formatted.length > 4) formatted = formatted.slice(0, 4) + "-" + formatted.slice(4);
                    if (formatted.length > 7) formatted = formatted.slice(0, 7) + "-" + formatted.slice(7, 9);
                    setStartDateInput(formatted);
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />
              )}

              <ThemedText style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Sampai tanggal</ThemedText>
              {Platform.OS === "web" ? (
                <View style={styles.webDatePickerWrap}>
                  <input
                    type="date"
                    value={toYYYYMMDD(endDate)}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      if (v) {
                        const d = new Date(v);
                        if (!Number.isNaN(d.getTime())) {
                          d.setHours(0, 0, 0, 0);
                          setEndDate(d);
                          if (d < startDate) setStartDate(new Date(d));
                        }
                      }
                    }}
                    style={{
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 8,
                      border: `1px solid ${colors.icon}40`,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </View>
              ) : (
                <TextInput
                  style={[styles.dateInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon + "40" }]}
                  placeholder="YYYY-MM-DD"
                  value={endDateInput}
                  onChangeText={(text) => {
                    let formatted = text.replace(/[^0-9]/g, "");
                    if (formatted.length > 4) formatted = formatted.slice(0, 4) + "-" + formatted.slice(4);
                    if (formatted.length > 7) formatted = formatted.slice(0, 7) + "-" + formatted.slice(7, 9);
                    setEndDateInput(formatted);
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />
              )}

              <View style={styles.dateActions}>
                <TouchableOpacity
                  style={[styles.dateActionButton, { borderColor: colors.icon + "40" }]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <ThemedText style={{ color: colors.text }}>Batal</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateActionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const d1 = new Date(startDateInput);
                    const d2 = new Date(endDateInput);
                    if (!Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime())) {
                      d1.setHours(0, 0, 0, 0);
                      d2.setHours(0, 0, 0, 0);
                      if (d1 <= d2) {
                        setStartDate(d1);
                        setEndDate(d2);
                      } else {
                        setStartDate(d2);
                        setEndDate(d1);
                      }
                      setShowDatePicker(false);
                    }
                  }}
                >
                  <ThemedText style={{ color: "#fff" }}>Terapkan</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  backButton: { padding: 4 },
  title: { fontSize: 22 },
  filterHeader: { marginBottom: 8 },
  filterTitle: { fontSize: 16 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 15 },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  datePickerModal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  closeButton: { padding: 4 },
  datePickerContent: { gap: 12 },
  webDatePickerWrap: { width: "100%" },
  dateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  dateActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  dateActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryRow: { marginTop: 16, marginBottom: 16 },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 13, marginBottom: 4 },
  summaryValue: { fontSize: 22 },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  printButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  printButtonText: { fontWeight: "600", fontSize: 14 },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  loadingContainer: { padding: 24, alignItems: "center" },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  errorText: { fontSize: 14 },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: "center" },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  expenseLeft: { flex: 1 },
  expenseCategory: { fontSize: 15 },
  expenseDesc: { fontSize: 13, marginTop: 2 },
  expenseMeta: { fontSize: 12, marginTop: 2 },
  expenseRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  expenseAmount: { fontSize: 16 },
  deleteButton: { padding: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
  },
  modalTitle: { marginBottom: 20, textAlign: "center" },
  inputLabel: { fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  amountInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amountInputText: {
    fontSize: 16,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  categoryChipText: { fontSize: 13 },
  categoryPickerBox: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "70%",
    borderRadius: 16,
    overflow: "hidden",
  },
  categoryPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  categoryPickerList: { maxHeight: 320 },
  categoryPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  categoryPickerItemText: { fontSize: 16 },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  modalCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  modalConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
