import { PrinterConnectModal } from "@/components/printer-connect-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  addGrosirPayment,
  getAllJualanGrosir,
  getGrosirPaymentsByJualanGrosirId,
  getJualanGrosirByDateRange,
} from "@/edysonpos/services/database";
import { thermalPrinter } from "@/edysonpos/services/thermal-printer";
import { sendPaymentReceiptToTelegram } from "@/edysonpos/services/telegram";
import type { GrosirPayment, GrosirPaymentStatus, JualanGrosir, PaymentRecord } from "@/edysonpos/types/database";
import { formatIDR } from "@/utils/currency";
import { formatDateTimeIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const STATUS_LABELS: Record<GrosirPaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
};

export default function GrosirInvoicesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { profile } = useAuth();

  const [invoices, setInvoices] = useState<JualanGrosir[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<JualanGrosir[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | GrosirPaymentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "range">("all");
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [selectedInvoice, setSelectedInvoice] = useState<JualanGrosir | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPayments, setDetailPayments] = useState<GrosirPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "QRIS" | "BNI" | "BRI" | "Mandiri">(
    "Cash"
  );
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const cashierName = profile?.fullName || profile?.email?.split("@")[0] || "User";

  useEffect(() => {
    loadInvoices();
  }, [dateFilter, startDate, endDate]);

  useEffect(() => {
    let list = [...invoices];
    if (statusFilter !== "all") {
      list = list.filter((inv) => (inv.payment_status ?? "unpaid") === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (inv) =>
          String(inv.invoiceNo).toLowerCase().includes(q) ||
          (inv.namaPelanggan ?? "").toLowerCase().includes(q)
      );
    }
    setFilteredInvoices(list);
  }, [invoices, statusFilter, searchQuery]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data =
        dateFilter === "range"
          ? await getJualanGrosirByDateRange(startDate, endDate)
          : await getAllJualanGrosir();
      setInvoices(data);
    } catch (e) {
      console.error("Error loading grosir invoices:", e);
      Alert.alert("Error", "Failed to load invoices.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const openDetail = async (invoice: JualanGrosir) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
    setLoadingPayments(true);
    try {
      const payments = await getGrosirPaymentsByJualanGrosirId(invoice.id);
      setDetailPayments(payments);
    } catch (e) {
      console.error("Error loading payments:", e);
      setDetailPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }
    if (amount > selectedInvoice.sisaBonGrosir) {
      Alert.alert(
        "Invalid Amount",
        `Amount cannot exceed remaining balance ${formatIDR(selectedInvoice.sisaBonGrosir)}.`
      );
      return;
    }
    try {
      setSubmittingPayment(true);
      const payment: PaymentRecord = {
        date: new Date().toISOString(),
        amount,
        paymentMethod,
        createdBy: cashierName,
      };
      const updated = await addGrosirPayment(selectedInvoice.id, payment, profile?.id);
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      const payments = await getGrosirPaymentsByJualanGrosirId(updated.id);
      setDetailPayments(payments);
      setShowPaymentModal(false);
      setPaymentAmount("");

      // Print payment receipt to thermal printer (client name, date/time, kasir, paid/total, PEMBAYARAN LUNAS when cleared)
      if (thermalPrinter.isConnected()) {
        try {
          await thermalPrinter.printGrosirPaymentReceipt({
            customerName: updated.namaPelanggan,
            invoiceNo: updated.invoiceNo,
            paymentAmount: amount,
            paymentMethod,
            date: new Date(payment.date),
            remainingBalance: updated.sisaBonGrosir,
            cashierName,
            totalBelanja: updated.totalBelanja,
            setorGrosir: updated.setorGrosir,
          });
        } catch (printErr) {
          console.error("Error printing payment receipt:", printErr);
        }
      }

      // Send payment receipt to Telegram
      try {
        await sendPaymentReceiptToTelegram({
          customerName: updated.namaPelanggan,
          invoiceNo: updated.invoiceNo,
          paymentAmount: amount,
          paymentMethod,
          date: new Date(payment.date),
          remainingBalance: updated.sisaBonGrosir,
          cashierName,
          totalBelanja: updated.totalBelanja,
          setorGrosir: updated.setorGrosir,
        });
      } catch (telegramErr) {
        console.error("Error sending payment receipt to Telegram:", telegramErr);
      }

      Alert.alert("Success", `Payment of ${formatIDR(amount)} recorded.`);
    } catch (e: any) {
      console.error("Error adding payment:", e);
      Alert.alert("Error", e?.message ?? "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusColor = (status: GrosirPaymentStatus | undefined) => {
    switch (status ?? "unpaid") {
      case "paid":
        return colors.success;
      case "partially_paid":
        return colors.secondary;
      default:
        return colors.error;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Grosir Invoices
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Status dropdown + Barcode/name search */}
      <View
        style={[
          styles.filterRow,
          styles.filterRowWithSearch,
          showStatusDropdown && styles.filterRowDropdownOpen,
        ]}
      >
        <TouchableOpacity
          style={[styles.statusDropdown, { backgroundColor: colors.cardBackground, borderColor: colors.icon + "40" }]}
          onPress={() => setShowStatusDropdown((v) => !v)}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.statusDropdownText, { color: colors.text }]} numberOfLines={1}>
            {statusFilter === "all" ? "All" : STATUS_LABELS[statusFilter]}
          </ThemedText>
          <Ionicons name={showStatusDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.icon} />
        </TouchableOpacity>
        {showStatusDropdown && (
          <View
            style={[
              styles.statusDropdownList,
              { backgroundColor: colors.cardBackground, borderColor: colors.icon + "30" },
            ]}
          >
            {(["all", "unpaid", "partially_paid", "paid"] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.statusDropdownItem, statusFilter === key && { backgroundColor: colors.primary + "20" }]}
                onPress={() => {
                  setStatusFilter(key);
                  setShowStatusDropdown(false);
                }}
              >
                <ThemedText style={[styles.statusDropdownItemText, { color: colors.text }]}>
                  {key === "all" ? "All" : STATUS_LABELS[key]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={[styles.searchWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.icon + "40" }]}>
          <Ionicons name="search-outline" size={20} color={colors.icon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by invoice # or name"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, dateFilter === "all" && { backgroundColor: colors.primary }]}
          onPress={() => setDateFilter("all")}
        >
          <ThemedText
            style={[styles.filterText, { color: dateFilter === "all" ? "#FFF" : colors.text }]}
          >
            All time
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, dateFilter === "range" && { backgroundColor: colors.primary }]}
          onPress={() => setDateFilter("range")}
        >
          <ThemedText
            style={[styles.filterText, { color: dateFilter === "range" ? "#FFF" : colors.text }]}
          >
            Date range
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
              Loading invoices...
            </ThemedText>
          </View>
        ) : filteredInvoices.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color={colors.icon} />
            <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
              No grosir invoices match the filters.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.cardGrid}>
            {filteredInvoices.map((inv) => {
              const status = (inv.payment_status ?? "unpaid") as GrosirPaymentStatus;
              const percent = inv.percent_paid ?? 0;
              const statusBg = getStatusColor(status);
              const statusLabel =
                STATUS_LABELS[status] +
                (status !== "unpaid" && status !== "paid" ? ` (${percent}%)` : "");
              return (
                <TouchableOpacity
                  key={inv.id}
                  activeOpacity={0.7}
                  onPress={() => openDetail(inv)}
                  style={styles.cardGridItem}
                >
                  <Card style={styles.invoiceCard}>
                    <ThemedText type="defaultSemiBold" style={[styles.cardInvoiceNo, { color: colors.text }]} numberOfLines={1}>
                      #{inv.invoiceNo}
                    </ThemedText>
                    <ThemedText type="defaultSemiBold" style={[styles.cardCustomer, { color: colors.text }]} numberOfLines={1}>
                      {inv.namaPelanggan}
                    </ThemedText>
                    <ThemedText style={[styles.cardDate, { color: colors.icon }]} numberOfLines={2}>
                      {inv.created_atIndo || formatDateTimeIndo(inv.created_at)}
                    </ThemedText>
                    <ThemedText type="subtitle" style={[styles.cardTotal, { color: colors.primary }]}>
                      {formatIDR(inv.totalBelanja)}
                    </ThemedText>
                    <View style={styles.setorSisaRow}>
                      <ThemedText style={[styles.setorSisa, { color: colors.text }]} numberOfLines={1}>
                        Setor: {formatIDR(inv.setorGrosir)}
                      </ThemedText>
                      <ThemedText style={[styles.setorSisa, inv.sisaBonGrosir > 0 ? { color: colors.error } : { color: colors.text }]} numberOfLines={1}>
                        Sisa: {formatIDR(inv.sisaBonGrosir)}
                      </ThemedText>
                    </View>
                    <View style={[styles.statusBadgeCard, { backgroundColor: statusBg }]}>
                      <ThemedText style={styles.statusTextBold}>
                        {statusLabel}
                      </ThemedText>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Invoice #{selectedInvoice?.invoiceNo}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowDetailModal(false);
                  setSelectedInvoice(null);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {selectedInvoice && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Card style={styles.detailCard}>
                  <ThemedText style={[styles.detailLabel, { color: colors.icon }]}>
                    Customer
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                    {selectedInvoice.namaPelanggan}
                  </ThemedText>
                  <ThemedText style={[styles.detailLabel, { color: colors.icon }]}>
                    Total / Setor / Sisa
                  </ThemedText>
                  <ThemedText style={{ color: colors.text }}>
                    {formatIDR(selectedInvoice.totalBelanja)} / {formatIDR(selectedInvoice.setorGrosir)} /{" "}
                    {formatIDR(selectedInvoice.sisaBonGrosir)}
                  </ThemedText>
                  <ThemedText style={[styles.detailLabel, { color: colors.icon }]}>
                    Status
                  </ThemedText>
                  <ThemedText style={{ color: getStatusColor(selectedInvoice.payment_status as GrosirPaymentStatus) }}>
                    {STATUS_LABELS[(selectedInvoice.payment_status ?? "unpaid") as GrosirPaymentStatus]}
                    {selectedInvoice.percent_paid != null && selectedInvoice.payment_status === "partially_paid"
                      ? ` (${selectedInvoice.percent_paid}% paid)`
                      : ""}
                  </ThemedText>
                </Card>
                <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
                  Payment history
                </ThemedText>
                {loadingPayments ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                ) : detailPayments.length === 0 ? (
                  <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                    No payments recorded yet.
                  </ThemedText>
                ) : (
                  detailPayments.map((p) => (
                    <Card key={p.id} style={styles.paymentRow}>
                      <View style={styles.paymentRowLeft}>
                        <ThemedText style={{ color: colors.text }}>
                          {formatDateTimeIndo(p.created_at)}
                        </ThemedText>
                        <ThemedText style={[styles.paymentMethodLabel, { color: colors.icon }]}>
                          {p.paymentMethod} · {p.createdBy}
                        </ThemedText>
                      </View>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                        {formatIDR(p.amount)}
                      </ThemedText>
                    </Card>
                  ))
                )}
                {selectedInvoice.sisaBonGrosir > 0 && (
                  <View style={styles.addPaymentWrap}>
                    <Button
                      title="Add Payment"
                      onPress={() => setShowPaymentModal(true)}
                      style={styles.addPaymentBtn}
                    />
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add payment modal */}
      <Modal
        visible={showPaymentModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <View style={[styles.paymentModalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Add Payment
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount("");
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {selectedInvoice && (
              <>
                <ScrollView 
                  style={styles.paymentModalScroll} 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.paymentModalScrollContent}
                >
                  <Card style={styles.detailCard}>
                    <ThemedText style={[styles.detailLabel, { color: colors.icon }]}>
                      Payment summary
                    </ThemedText>
                    <ThemedText style={{ color: colors.text, marginBottom: 4 }}>
                      Total: {formatIDR(selectedInvoice.totalBelanja)} · Paid: {formatIDR(selectedInvoice.setorGrosir)} / {formatIDR(selectedInvoice.totalBelanja)}
                    </ThemedText>
                    {(() => {
                      const amt = parseFloat(paymentAmount) || 0;
                      const afterPaid = selectedInvoice.setorGrosir + amt;
                      const willBeLunas = afterPaid >= selectedInvoice.totalBelanja;
                      return amt > 0 ? (
                        <>
                          <ThemedText style={{ color: colors.text, marginBottom: 4 }}>
                            After this payment: {formatIDR(afterPaid)} / {formatIDR(selectedInvoice.totalBelanja)}
                          </ThemedText>
                          {willBeLunas && (
                            <ThemedText type="defaultSemiBold" style={{ color: colors.success, fontSize: 14, marginTop: 4 }}>
                              PEMBAYARAN LUNAS
                            </ThemedText>
                          )}
                        </>
                      ) : null;
                    })()}
                  </Card>
                  <Card style={styles.detailCard}>
                    <ThemedText style={[styles.detailLabel, { color: colors.icon }]}>
                      Remaining balance
                    </ThemedText>
                    <ThemedText type="title" style={{ color: colors.error }}>
                      {formatIDR(selectedInvoice.sisaBonGrosir)}
                    </ThemedText>
                  </Card>
                  <Card style={styles.detailCard}>
                    <ThemedText style={[styles.detailLabel, { color: colors.text }]}>
                      Amount
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.amountInput,
                        { backgroundColor: colors.background, color: colors.text },
                      ]}
                      value={paymentAmount}
                      onChangeText={(t) => setPaymentAmount(t.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      placeholderTextColor={colors.icon}
                      keyboardType="numeric"
                    />
                  </Card>
                  <Card style={styles.detailCard}>
                    <ThemedText style={[styles.detailLabel, { color: colors.text }]}>
                      Payment method
                    </ThemedText>
                    <View style={styles.methodRow}>
                      {(["Cash", "QRIS", "BNI", "BRI", "Mandiri"] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.methodChip,
                            {
                              backgroundColor: paymentMethod === m ? colors.primary : colors.background,
                              borderColor: paymentMethod === m ? colors.primary : colors.icon + "40",
                            },
                          ]}
                          onPress={() => setPaymentMethod(m)}
                        >
                          <ThemedText
                            style={{
                              color: paymentMethod === m ? "#FFF" : colors.text,
                              fontWeight: "600",
                            }}
                          >
                            {m}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>

                  {/* Printer status in Add Payment modal */}
                  <Card style={styles.detailCard}>
                    <View style={styles.printerStatusRow}>
                      <Ionicons
                        name={thermalPrinter.isConnected() ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={thermalPrinter.isConnected() ? "#4CAF50" : colors.icon}
                      />
                      <ThemedText style={[styles.printerStatusText, { color: colors.text }]}>
                        Printer: {thermalPrinter.isConnected()
                          ? thermalPrinter.getConnectionStatus().device?.name ?? "Connected"
                          : "Not connected"}
                      </ThemedText>
                      <TouchableOpacity
                        style={[styles.printerConnectBtn, { backgroundColor: colors.primary }]}
                        onPress={() => setShowPrinterModal(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.printerConnectBtnText}>
                          {thermalPrinter.isConnected() ? "Change" : "Connect"}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    <ThemedText style={[styles.detailLabel, { color: colors.icon, fontSize: 12, marginTop: 6 }]}>
                      Receipt will print when payment is recorded (client name, date/time, kasir, paid/total, PEMBAYARAN LUNAS when cleared).
                    </ThemedText>
                  </Card>
                </ScrollView>

                <View style={[styles.paymentModalFooter, { borderTopColor: colors.icon + "30" }]}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => {
                      setShowPaymentModal(false);
                      setPaymentAmount("");
                    }}
                    style={styles.footerBtn}
                  />
                  <Button
                    title="Record Payment"
                    onPress={handleAddPayment}
                    loading={submittingPayment}
                    style={styles.footerBtn}
                    size="large"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <PrinterConnectModal
        visible={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 22 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterRowWithSearch: {
    alignItems: "center",
    position: "relative",
    overflow: "visible",
  },
  filterRowDropdownOpen: {
    zIndex: 9999,
    elevation: 9999,
  },
  statusDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 140,
  },
  statusDropdownText: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  statusDropdownList: {
    position: "absolute",
    left: 16,
    top: 48,
    zIndex: 10000,
    elevation: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 180,
    paddingVertical: 4,
    boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
  },
  statusDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusDropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
  },
  searchWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    minWidth: 0,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  filterChipText: { fontSize: 14, fontWeight: "600" },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
  },
  filterText: { fontSize: 14, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: "center" },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cardGridItem: {
    width: "48%",
    minWidth: 140,
  },
  invoiceCard: {
    padding: 14,
    minHeight: 180,
  },
  cardInvoiceNo: { fontSize: 13, marginBottom: 2 },
  cardCustomer: { fontSize: 14, marginBottom: 4 },
  cardDate: { fontSize: 11, marginBottom: 8 },
  cardTotal: { fontSize: 16, marginBottom: 4 },
  setorSisaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  setorSisa: { fontSize: 12 },
  statusBadgeCard: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: 16,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  paymentModalContent: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeButton: { padding: 8 },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 24 },
  detailCard: { marginBottom: 16, padding: 14 },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  sectionTitle: { marginBottom: 12, fontSize: 16 },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
  },
  paymentRowLeft: { flex: 1 },
  paymentMethodLabel: { fontSize: 12, marginTop: 2 },
  addPaymentWrap: { marginTop: 16, marginBottom: 24 },
  addPaymentBtn: { width: "100%" },
  amountInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  methodChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  printerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  printerStatusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  printerConnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  printerConnectBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  paymentModalScroll: {
    maxHeight: 400,
  },
  paymentModalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  paymentModalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  footerBtn: { flex: 1 },
});
