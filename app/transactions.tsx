import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorMessage } from "@/components/ui/error-message";
import { SkeletonList } from "@/components/ui/skeleton";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import {
  addGrosirPayment,
  getJualanGrosirByDateRange,
  getJualanItemsByGrosirId,
  getJualanItemsByKontanId,
  getJualanKontanByDateRange,
} from "@/services/database";
import { thermalPrinter } from "@/services/thermal-printer";
import type { JualanGrosir, JualanItem, JualanKontan, PaymentRecord } from "@/types/database";
import type { ReceiptData } from "@/utils/receipt-formatter";
import { formatIDR } from "@/utils/currency";
import { formatDateIndo, formatDateTimeIndo } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  useWindowDimensions,
  View,
} from "react-native";

type Transaction = (JualanKontan & { type: "kontan" }) | (JualanGrosir & { type: "grosir" });

export default function TransactionsScreen() {
  const router = useRouter();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();

  // Responsive: centered modal on tablet/web (>= 600px), bottom sheet on phone
  const isLargeScreen = width >= 600;
  const detailModalMaxWidth = Math.min(520, width - 48);
  const colors = Colors[colorScheme ?? "light"];
  const { profile } = useAuth();
  const { canViewAllTransactions } = usePermissions();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "kontan" | "grosir">(
    filterParam === "grosir" ? "grosir" : filterParam === "kontan" ? "kontan" : "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [transactionItems, setTransactionItems] = useState<JualanItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "QRIS" | "BNI" | "BRI" | "Mandiri">(
    "Cash"
  );
  const cashierName = profile?.fullName || profile?.email?.split("@")[0] || "User";
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 days ago
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<"start" | "end">("start");
  const [dateInputValue, setDateInputValue] = useState("");
  const [reprintLoading, setReprintLoading] = useState(false);
  const [suratJalanLoading, setSuratJalanLoading] = useState(false);
  const [telegramResendLoading, setTelegramResendLoading] = useState(false);
  const [showPaymentFilterModal, setShowPaymentFilterModal] = useState(false);
  const [showCashierFilterModal, setShowCashierFilterModal] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [filter, startDate, endDate]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, filter, paymentFilter, cashierFilter, searchQuery, startDate, endDate]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // For cashiers, only load their own transactions
      // For admin/manager, load all transactions
      const userId = canViewAllTransactions ? undefined : profile?.id;

      const [kontanSales, grosirSales] = await Promise.all([
        getJualanKontanByDateRange(startDate, endDate, userId),
        getJualanGrosirByDateRange(startDate, endDate, userId),
      ]);

      const kontanTransactions: Transaction[] = kontanSales.map((sale) => ({
        ...sale,
        type: "kontan" as const,
      }));

      const grosirTransactions: Transaction[] = grosirSales.map((sale) => ({
        ...sale,
        type: "grosir" as const,
      }));

      const allTransactions = [...kontanTransactions, ...grosirTransactions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (filter === "all") {
        setTransactions(allTransactions);
      } else if (filter === "kontan") {
        setTransactions(kontanTransactions);
      } else {
        setTransactions(grosirTransactions);
      }
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      let errorMessage = "Failed to load transactions. Please check your connection and try again.";
      if (error.message?.includes("406")) {
        errorMessage = "Access denied. Please check your permissions or contact administrator.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getUniquePaymentMethods = (): string[] => {
    const methods = new Set<string>();
    transactions.forEach((t) => {
      if (t.caraPembayaran) {
        methods.add(t.caraPembayaran);
      }
    });
    return Array.from(methods).sort();
  };

  const getUniqueCashiers = (): string[] => {
    const cashiers = new Set<string>();
    transactions.forEach((t) => {
      if (t.namaKasir) {
        cashiers.add(t.namaKasir);
      }
    });
    return Array.from(cashiers).sort();
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Filter by payment method
    if (paymentFilter !== "all") {
      filtered = filtered.filter((t) => t.caraPembayaran === paymentFilter);
    }

    // Filter by cashier
    if (cashierFilter !== "all") {
      filtered = filtered.filter((t) => t.namaKasir === cashierFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => {
        const isKontan = t.type === "kontan";
        const searchableText = [
          t.id,
          t.namaKasir,
          t.caraPembayaran,
          isKontan ? "" : (t as JualanGrosir).namaPelanggan,
          isKontan ? "" : `#${(t as JualanGrosir).invoiceNo}`,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    setFilteredTransactions(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const handleTransactionPress = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
    setLoadingItems(true);
    setTransactionItems([]); // Clear previous items

    try {
      console.log("Loading items for transaction:", transaction.id, "type:", transaction.type);
      let items: JualanItem[] = [];
      if (transaction.type === "kontan") {
        items = await getJualanItemsByKontanId(transaction.id);
      } else {
        items = await getJualanItemsByGrosirId(transaction.id);
      }
      console.log("Loaded items:", items.length);
      setTransactionItems(items);
    } catch (error: any) {
      console.error("Error loading transaction items:", error);
      const errorMessage = error?.message || "Failed to load transaction items.";
      console.error("Error details:", JSON.stringify(error, null, 2));
      Alert.alert("Error", errorMessage);
      setTransactionItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  /** Map JualanItem[] to ReceiptData items (CartItem-like) for thermal printer. */
  const jualanItemsToReceiptItems = (items: JualanItem[]): ReceiptData["items"] => {
    return items.map((item) => ({
      barang: {
        id: item.barangId,
        createdAt: "",
        createdBy: "",
        barangNama: item.barangNama,
        barangType: "",
        barangUnit: item.barangUnit,
        barangHarga: item.unitPrice,
        barangModal: 0,
        barangGrosir: 0,
        barangBon: 0,
        barangNote: null,
        stockBarang: 0,
        stockTokoMini: 0,
      },
      quantity: item.quantity,
      price: item.unitPrice,
    }));
  };

  const handleReprintReceipt = async () => {
    if (!selectedTransaction) return;

    if (!thermalPrinter.isConnected()) {
      Alert.alert(
        "Printer not connected",
        "Connect a printer in Settings to reprint receipts.",
        [{ text: "OK" }]
      );
      return;
    }

    const total =
      selectedTransaction.type === "kontan"
        ? Number(selectedTransaction.totalBelanja)
        : selectedTransaction.totalBelanja;
    const items = jualanItemsToReceiptItems(transactionItems);
    const base: ReceiptData = {
      items,
      total,
      paymentMethod: selectedTransaction.caraPembayaran,
      cashierName: selectedTransaction.namaKasir,
      date: new Date(selectedTransaction.created_at),
      saleId: selectedTransaction.id,
    };
    const receiptData: ReceiptData =
      selectedTransaction.type === "kontan"
        ? { ...base, cashReceived: total, change: 0 }
        : (() => {
            const g = selectedTransaction as JualanGrosir;
            return {
              ...base,
              customerName: g.namaPelanggan,
              invoiceNo: g.invoiceNo,
              setorGrosir: g.setorGrosir,
              sisaBonGrosir: g.sisaBonGrosir,
            };
          })();

    setReprintLoading(true);
    try {
      if (selectedTransaction.type === "kontan") {
        await thermalPrinter.printCashReceipt(receiptData);
      } else {
        await thermalPrinter.printWholesaleReceipt(receiptData);
      }
      Alert.alert("Reprint", "Receipt sent to printer.", [{ text: "OK" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to print receipt.";
      Alert.alert("Reprint failed", msg, [{ text: "OK" }]);
    } finally {
      setReprintLoading(false);
    }
  };

  const handlePrintSuratJalan = async () => {
    if (!selectedTransaction || selectedTransaction.type !== "grosir") return;

    if (!thermalPrinter.isConnected()) {
      Alert.alert(
        "Printer not connected",
        "Connect a printer in Settings to print surat jalan.",
        [{ text: "OK" }]
      );
      return;
    }

    const g = selectedTransaction as JualanGrosir;
    const total = g.totalBelanja;
    const items = jualanItemsToReceiptItems(transactionItems);
    const receiptData: ReceiptData = {
      items,
      total,
      paymentMethod: selectedTransaction.caraPembayaran,
      cashierName: selectedTransaction.namaKasir,
      date: new Date(selectedTransaction.created_at),
      saleId: selectedTransaction.id,
      customerName: g.namaPelanggan,
      invoiceNo: g.invoiceNo,
      setorGrosir: g.setorGrosir,
      sisaBonGrosir: g.sisaBonGrosir,
    };

    setSuratJalanLoading(true);
    try {
      await thermalPrinter.printGrosirSuratJalan(receiptData);
      Alert.alert("Surat Jalan", "Surat jalan sent to printer.", [{ text: "OK" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to print surat jalan.";
      Alert.alert("Print failed", msg, [{ text: "OK" }]);
    } finally {
      setSuratJalanLoading(false);
    }
  };

  const buildWholesaleReceiptData = (): ReceiptData | null => {
    if (!selectedTransaction || selectedTransaction.type !== "grosir") return null;
    const g = selectedTransaction as JualanGrosir;
    const items = jualanItemsToReceiptItems(transactionItems);
    return {
      items,
      total: g.totalBelanja,
      paymentMethod: selectedTransaction.caraPembayaran,
      cashierName: selectedTransaction.namaKasir,
      date: new Date(selectedTransaction.created_at),
      saleId: selectedTransaction.id,
      customerName: g.namaPelanggan,
      invoiceNo: g.invoiceNo,
      setorGrosir: g.setorGrosir,
      sisaBonGrosir: g.sisaBonGrosir,
    };
  };

  const handleResendToTelegram = async () => {
    const receiptData = buildWholesaleReceiptData();
    if (!receiptData) return;
    const g = selectedTransaction as JualanGrosir;

    setTelegramResendLoading(true);
    try {
      const { sendWholesaleSaleToTelegram } = await import("@/services/telegram");
      await sendWholesaleSaleToTelegram(receiptData, "A4", g.invoiceNo, "TOKO EDYSON");
      Alert.alert("Success", "PDF Nota sent to Telegram successfully.", [{ text: "OK" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send to Telegram.";
      Alert.alert("Telegram Resend Failed", msg, [{ text: "OK" }]);
    } finally {
      setTelegramResendLoading(false);
    }
  };

  const handleSendSuratJalanToTelegram = async () => {
    const receiptData = buildWholesaleReceiptData();
    if (!receiptData) return;
    const g = selectedTransaction as JualanGrosir;

    setTelegramResendLoading(true);
    try {
      const { sendWholesaleSaleToTelegram } = await import("@/services/telegram");
      await sendWholesaleSaleToTelegram(receiptData, "A4", g.invoiceNo, "SURAT JALAN");
      Alert.alert("Success", "PDF Surat Jalan sent to Telegram successfully.", [{ text: "OK" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send to Telegram.";
      Alert.alert("Telegram Resend Failed", msg, [{ text: "OK" }]);
    } finally {
      setTelegramResendLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedTransaction || selectedTransaction.type !== "grosir") {
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }

    const grosirTransaction = selectedTransaction as JualanGrosir;
    if (amount > grosirTransaction.sisaBonGrosir) {
      Alert.alert(
        "Invalid Amount",
        `Payment amount cannot exceed remaining balance of ${formatIDR(
          grosirTransaction.sisaBonGrosir
        )}.`
      );
      return;
    }

    try {
      setLoadingItems(true);
      const payment: PaymentRecord = {
        date: new Date().toISOString(),
        amount,
        paymentMethod,
        createdBy: cashierName,
      };

      const updatedSale = await addGrosirPayment(
        grosirTransaction.id,
        payment,
        profile?.id
      );

      // Update the transaction in the list
      setTransactions((prev) =>
        prev.map((t) => (t.id === updatedSale.id ? { ...updatedSale, type: "grosir" as const } : t))
      );

      // Update selected transaction
      setSelectedTransaction({ ...updatedSale, type: "grosir" as const });

      // Print payment receipt to thermal printer (client name, date/time, kasir, paid/total, PEMBAYARAN LUNAS when cleared)
      if (thermalPrinter.isConnected()) {
        try {
          await thermalPrinter.printGrosirPaymentReceipt({
            customerName: updatedSale.namaPelanggan,
            invoiceNo: updatedSale.invoiceNo,
            paymentAmount: amount,
            paymentMethod: paymentMethod,
            date: new Date(payment.date),
            remainingBalance: updatedSale.sisaBonGrosir,
            cashierName: cashierName,
            totalBelanja: updatedSale.totalBelanja,
            setorGrosir: updatedSale.setorGrosir,
          });
        } catch (printErr) {
          console.error("Error printing payment receipt:", printErr);
        }
      }

      // Send payment receipt to Telegram
      try {
        const { sendPaymentReceiptToTelegram } = await import("@/services/telegram");
        await sendPaymentReceiptToTelegram({
          customerName: updatedSale.namaPelanggan,
          invoiceNo: updatedSale.invoiceNo,
          paymentAmount: amount,
          paymentMethod: paymentMethod,
          date: new Date(payment.date),
          remainingBalance: updatedSale.sisaBonGrosir,
          cashierName: cashierName,
          totalBelanja: updatedSale.totalBelanja,
          setorGrosir: updatedSale.setorGrosir,
        });
      } catch (telegramError) {
        console.error("Error sending payment receipt to Telegram:", telegramError);
        // Don't fail the payment if Telegram fails
      }

      Alert.alert("Success", `Payment of ${formatIDR(amount)} recorded successfully.`);
      setShowPaymentModal(false);
      setPaymentAmount("");
    } catch (error: any) {
      console.error("Error adding payment:", error);
      Alert.alert("Error", "Failed to record payment. Please try again.");
    } finally {
      setLoadingItems(false);
    }
  };

  const renderTransaction = (transaction: Transaction) => {
    const isKontan = transaction.type === "kontan";
    const total = isKontan ? Number(transaction.totalBelanja) : transaction.totalBelanja;

    return (
      <TouchableOpacity
        key={transaction.id}
        onPress={() => handleTransactionPress(transaction)}
        activeOpacity={0.7}
      >
        <Card style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <View style={styles.transactionInfo}>
              <View style={styles.transactionTypeRow}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                  {isKontan ? "Cash Sale" : "Wholesale Sale"}
                </ThemedText>
                {!isKontan && (
                  <View style={[styles.invoiceBadge, { backgroundColor: colors.primary + "20" }]}>
                    <ThemedText style={[styles.invoiceText, { color: colors.primary }]}>
                      #{transaction.invoiceNo}
                    </ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.transactionDate, { color: colors.icon }]}>
                {transaction.created_atIndo || formatDateTimeIndo(transaction.created_at)}
              </ThemedText>
              {!isKontan && (
                <ThemedText style={[styles.customerName, { color: colors.text }]}>
                  Customer: {transaction.namaPelanggan}
                </ThemedText>
              )}
              <ThemedText style={[styles.cashierName, { color: colors.icon }]}>
                Cashier: {transaction.namaKasir}
              </ThemedText>
            </View>
            <View style={styles.transactionAmount}>
              <ThemedText type="title" style={{ color: colors.primary }}>
                {formatIDR(total)}
              </ThemedText>
              <ThemedText style={[styles.paymentMethod, { color: colors.icon }]}>
                {transaction.caraPembayaran}
              </ThemedText>
            </View>
          </View>
          {!isKontan && (
            <View style={styles.grosirDetails}>
              <View style={styles.grosirDetailRow}>
                <ThemedText style={[styles.grosirLabel, { color: colors.icon }]}>Paid:</ThemedText>
                <ThemedText style={[styles.grosirValue, { color: colors.text }]}>
                  {formatIDR(transaction.setorGrosir)}
                </ThemedText>
              </View>
              <View style={styles.grosirDetailRow}>
                <ThemedText style={[styles.grosirLabel, { color: colors.icon }]}>
                  Remaining:
                </ThemedText>
                <ThemedText style={[styles.grosirValue, { color: colors.error }]}>
                  {formatIDR(transaction.sisaBonGrosir)}
                </ThemedText>
              </View>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Transactions
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.cardBackground }]}
          onPress={() => {
            setDatePickerType("start");
            setDateInputValue(startDate.toISOString().split("T")[0]);
            setShowDatePicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <ThemedText style={[styles.dateButtonText, { color: colors.text }]}>
            {formatDateIndo(startDate)}
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.dateSeparator, { color: colors.icon }]}>to</ThemedText>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.cardBackground }]}
          onPress={() => {
            setDatePickerType("end");
            setDateInputValue(endDate.toISOString().split("T")[0]);
            setShowDatePicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <ThemedText style={[styles.dateButtonText, { color: colors.text }]}>
            {formatDateIndo(endDate)}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.resetDateButton, { backgroundColor: colors.primary + "20" }]}
          onPress={() => {
            const newStartDate = new Date();
            newStartDate.setDate(newStartDate.getDate() - 7);
            newStartDate.setHours(0, 0, 0, 0);
            const newEndDate = new Date();
            newEndDate.setHours(23, 59, 59, 999);
            setStartDate(newStartDate);
            setEndDate(newEndDate);
          }}
        >
          <ThemedText style={[styles.resetDateText, { color: colors.primary }]}>Reset</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.icon} style={styles.searchIcon} />
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: colors.cardBackground, color: colors.text },
          ]}
          placeholder="Search transactions..."
          placeholderTextColor={colors.icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && { backgroundColor: colors.primary }]}
          onPress={() => setFilter("all")}
        >
          <ThemedText
            style={[styles.filterText, { color: filter === "all" ? "#FFFFFF" : colors.text }]}
          >
            All
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "kontan" && { backgroundColor: colors.primary }]}
          onPress={() => setFilter("kontan")}
        >
          <ThemedText
            style={[styles.filterText, { color: filter === "kontan" ? "#FFFFFF" : colors.text }]}
          >
            Cash
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "grosir" && { backgroundColor: colors.primary }]}
          onPress={() => setFilter("grosir")}
        >
          <ThemedText
            style={[styles.filterText, { color: filter === "grosir" ? "#FFFFFF" : colors.text }]}
          >
            Wholesale
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Additional Filters - single row with modal triggers */}
      {(getUniquePaymentMethods().length > 1 || getUniqueCashiers().length > 1) && (
        <View style={styles.filterSingleRow}>
          <View style={styles.filterTriggerHalf}>
            <ThemedText style={[styles.filterLabelInline, { color: colors.text }]}>Cashier:</ThemedText>
            <TouchableOpacity
              style={[styles.filterTriggerButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowCashierFilterModal(true)}
            >
              <ThemedText style={[styles.filterTriggerText, { color: colors.text }]} numberOfLines={1}>
                {cashierFilter === "all" ? "All" : cashierFilter.split("@")[0]}
              </ThemedText>
              <Ionicons name="chevron-down" size={16} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.filterTriggerHalf}>
            <ThemedText style={[styles.filterLabelInline, { color: colors.text }]}>Payment:</ThemedText>
            <TouchableOpacity
              style={[styles.filterTriggerButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowPaymentFilterModal(true)}
            >
              <ThemedText style={[styles.filterTriggerText, { color: colors.text }]} numberOfLines={1}>
                {paymentFilter === "all" ? "All" : paymentFilter}
              </ThemedText>
              <Ionicons name="chevron-down" size={16} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Filter Modal */}
      <Modal
        visible={showPaymentFilterModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowPaymentFilterModal(false)}
          />
          <View style={[styles.filterModalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.filterModalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Payment
              </ThemedText>
              <TouchableOpacity onPress={() => setShowPaymentFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterModalList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.filterCheckboxRow}
                onPress={() => {
                  setPaymentFilter("all");
                  setShowPaymentFilterModal(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={paymentFilter === "all" ? "checkbox" : "checkbox-outline"}
                  size={22}
                  color={paymentFilter === "all" ? colors.primary : colors.icon}
                />
                <ThemedText style={[styles.filterCheckboxLabel, { color: colors.text }]}>All</ThemedText>
              </TouchableOpacity>
              {getUniquePaymentMethods().map((method) => (
                <TouchableOpacity
                  key={method}
                  style={styles.filterCheckboxRow}
                  onPress={() => {
                    setPaymentFilter(method);
                    setShowPaymentFilterModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={paymentFilter === method ? "checkbox" : "checkbox-outline"}
                    size={22}
                    color={paymentFilter === method ? colors.primary : colors.icon}
                  />
                  <ThemedText style={[styles.filterCheckboxLabel, { color: colors.text }]}>
                    {method}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cashier Filter Modal */}
      <Modal
        visible={showCashierFilterModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCashierFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCashierFilterModal(false)}
          />
          <View style={[styles.filterModalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.filterModalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Cashier
              </ThemedText>
              <TouchableOpacity onPress={() => setShowCashierFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterModalList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.filterCheckboxRow}
                onPress={() => {
                  setCashierFilter("all");
                  setShowCashierFilterModal(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cashierFilter === "all" ? "checkbox" : "checkbox-outline"}
                  size={22}
                  color={cashierFilter === "all" ? colors.primary : colors.icon}
                />
                <ThemedText style={[styles.filterCheckboxLabel, { color: colors.text }]}>All</ThemedText>
              </TouchableOpacity>
              {getUniqueCashiers().map((cashier) => (
                <TouchableOpacity
                  key={cashier}
                  style={styles.filterCheckboxRow}
                  onPress={() => {
                    setCashierFilter(cashier);
                    setShowCashierFilterModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cashierFilter === cashier ? "checkbox" : "checkbox-outline"}
                    size={22}
                    color={cashierFilter === cashier ? colors.primary : colors.icon}
                  />
                  <ThemedText style={[styles.filterCheckboxLabel, { color: colors.text }]}>
                    {cashier.split("@")[0]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : error ? (
          <ErrorMessage
            title="Failed to Load Transactions"
            message={error}
            onRetry={loadTransactions}
            retryLabel="Retry"
          />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="No Transactions Found"
            message={
              searchQuery || paymentFilter !== "all" || cashierFilter !== "all"
                ? "No transactions match your current filters. Try adjusting your search or filters."
                : "No transactions have been recorded yet. Start by making a sale!"
            }
            icon="receipt-outline"
          />
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <ThemedText style={[styles.summaryText, { color: colors.text }]}>
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </ThemedText>
              <ThemedText
                style={[styles.summaryText, { color: colors.icon, fontSize: 11, marginTop: 4 }]}
              >
                {formatDateIndo(startDate)} - {formatDateIndo(endDate)}
              </ThemedText>
            </Card>
            {filteredTransactions.map(renderTransaction)}
          </>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType={isLargeScreen ? "fade" : "slide"}
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={[styles.modalOverlay, isLargeScreen && styles.modalOverlayCenter]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground },
              isLargeScreen && {
                maxWidth: detailModalMaxWidth,
                width: "100%",
                borderRadius: 16,
                maxHeight: "90%",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Transaction Details
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowDetailModal(false);
                  setSelectedTransaction(null);
                  setTransactionItems([]);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedTransaction && (
                <>
                  {/* Compact Header Info */}
                  <Card style={styles.detailCard}>
                    <View style={styles.compactHeader}>
                      <View style={styles.compactHeaderLeft}>
                        <View style={styles.compactHeaderTop}>
                          <View
                            style={[
                              styles.typeBadge,
                              {
                                backgroundColor:
                                  selectedTransaction.type === "kontan"
                                    ? colors.primary + "20"
                                    : colors.primary + "20",
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.typeBadgeText,
                                { color: colors.primary, fontSize: 11 },
                              ]}
                            >
                              {selectedTransaction.type === "kontan" ? "CASH" : "WHOLESALE"}
                            </ThemedText>
                          </View>
                          {selectedTransaction.type === "grosir" && (
                            <ThemedText style={[styles.invoiceNumber, { color: colors.primary }]}>
                              #{(selectedTransaction as JualanGrosir).invoiceNo}
                            </ThemedText>
                          )}
                        </View>
                        <ThemedText
                          style={[styles.compactDate, { color: colors.icon, fontSize: 12 }]}
                        >
                          {selectedTransaction.created_atIndo ||
                            formatDateTimeIndo(selectedTransaction.created_at)}
                        </ThemedText>
                      </View>
                      <View style={styles.compactHeaderRight}>
                        <ThemedText type="title" style={{ color: colors.primary, fontSize: 20 }}>
                          {formatIDR(
                            selectedTransaction.type === "kontan"
                              ? Number(selectedTransaction.totalBelanja)
                              : selectedTransaction.totalBelanja
                          )}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Compact Info Grid */}
                    <View style={styles.compactInfoGrid}>
                      {selectedTransaction.type === "grosir" && (
                        <View style={styles.compactInfoItem}>
                          <Ionicons name="person-outline" size={14} color={colors.icon} />
                          <ThemedText style={[styles.compactInfoText, { color: colors.text }]}>
                            {(selectedTransaction as JualanGrosir).namaPelanggan}
                          </ThemedText>
                        </View>
                      )}
                      <View style={styles.compactInfoItem}>
                        <Ionicons name="person-circle-outline" size={14} color={colors.icon} />
                        <ThemedText style={[styles.compactInfoText, { color: colors.text }]}>
                          {selectedTransaction.namaKasir}
                        </ThemedText>
                      </View>
                      <View style={styles.compactInfoItem}>
                        <Ionicons name="card-outline" size={14} color={colors.icon} />
                        <ThemedText style={[styles.compactInfoText, { color: colors.text }]}>
                          {selectedTransaction.caraPembayaran}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Payment Summary (Wholesale only) */}
                    {selectedTransaction.type === "grosir" && (
                      <View style={styles.paymentSummary}>
                        <View style={styles.paymentSummaryRow}>
                          <ThemedText style={[styles.paymentSummaryLabel, { color: colors.icon }]}>
                            Paid
                          </ThemedText>
                          <ThemedText style={[styles.paymentSummaryValue, { color: colors.text }]}>
                            {formatIDR((selectedTransaction as JualanGrosir).setorGrosir)}
                          </ThemedText>
                        </View>
                        <View style={styles.paymentSummaryRow}>
                          <ThemedText style={[styles.paymentSummaryLabel, { color: colors.icon }]}>
                            Remaining
                          </ThemedText>
                          <ThemedText style={[styles.paymentSummaryValue, { color: colors.error }]}>
                            {formatIDR((selectedTransaction as JualanGrosir).sisaBonGrosir)}
                          </ThemedText>
                        </View>
                      </View>
                    )}
                  </Card>

                  {/* Action buttons – shown first */}
                  <View style={styles.actionButtonsWrapper}>
                    <View style={styles.actionButtonRow}>
                      <View style={styles.actionButtonHalf}>
                        <Button
                          title={reprintLoading ? "Printing…" : "Reprint receipt"}
                          onPress={handleReprintReceipt}
                          disabled={reprintLoading || suratJalanLoading || telegramResendLoading}
                          style={styles.addPaymentButton}
                          size="large"
                        />
                      </View>
                      {selectedTransaction.type === "grosir" && (
                        <View style={styles.actionButtonHalf}>
                          <Button
                            title={suratJalanLoading ? "Printing…" : "Print Surat Jalan"}
                            onPress={handlePrintSuratJalan}
                            disabled={reprintLoading || suratJalanLoading || telegramResendLoading}
                            style={styles.addPaymentButton}
                            size="large"
                          />
                        </View>
                      )}
                    </View>
                    {selectedTransaction.type === "grosir" && (
                      <View style={styles.actionButtonRow}>
                        <View style={styles.actionButtonHalf}>
                          <Button
                            title={
                              telegramResendLoading ? "Sending…" : "PDF Nota"
                            }
                            onPress={handleResendToTelegram}
                            disabled={reprintLoading || suratJalanLoading || telegramResendLoading}
                            style={styles.addPaymentButton}
                            size="large"
                          />
                        </View>
                        <View style={styles.actionButtonHalf}>
                          <Button
                            title={
                              telegramResendLoading ? "Sending…" : "PDF Surat Jalan"
                            }
                            onPress={handleSendSuratJalanToTelegram}
                            disabled={reprintLoading || suratJalanLoading || telegramResendLoading}
                            style={styles.addPaymentButton}
                            size="large"
                          />
                        </View>
                      </View>
                    )}
                    {selectedTransaction.type === "grosir" &&
                      (selectedTransaction as JualanGrosir).sisaBonGrosir > 0 && (
                        <View style={styles.actionButtonRow}>
                          <View style={styles.actionButtonHalf}>
                            <Button
                              title="Add Payment"
                              onPress={() => setShowPaymentModal(true)}
                              style={styles.addPaymentButton}
                              size="large"
                            />
                          </View>
                        </View>
                      )}
                  </View>

                  {/* Payment History (Wholesale only) */}
                  {selectedTransaction.type === "grosir" && (
                    <Card style={styles.detailCard}>
                      <View style={styles.itemsHeader}>
                        <ThemedText type="subtitle" style={{ color: colors.text, fontSize: 14 }}>
                          Payment History
                        </ThemedText>
                        {(selectedTransaction as JualanGrosir).paymentHistory &&
                          (selectedTransaction as JualanGrosir).paymentHistory!.length > 0 && (
                            <ThemedText
                              style={[
                                styles.itemsCount,
                                { color: colors.icon, backgroundColor: colors.primary + "15" },
                              ]}
                            >
                              {(selectedTransaction as JualanGrosir).paymentHistory!.length}
                            </ThemedText>
                          )}
                      </View>
                      {(selectedTransaction as JualanGrosir).paymentHistory &&
                      (selectedTransaction as JualanGrosir).paymentHistory!.length > 0 ? (
                        <View style={styles.paymentHistoryList}>
                          {(selectedTransaction as JualanGrosir).paymentHistory!.map(
                            (payment, index) => (
                              <View
                                key={index}
                                style={[
                                  styles.compactPaymentRow,
                                  index <
                                    (selectedTransaction as JualanGrosir).paymentHistory!.length -
                                      1 && {
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.icon + "15",
                                    paddingBottom: 10,
                                    marginBottom: 10,
                                  },
                                ]}
                              >
                                <View style={styles.compactPaymentInfo}>
                                  <ThemedText
                                    style={[styles.compactPaymentDate, { color: colors.text }]}
                                  >
                                    {formatDateTimeIndo(payment.date)}
                                  </ThemedText>
                                  <ThemedText
                                    style={[
                                      styles.compactPaymentMethod,
                                      { color: colors.icon, fontSize: 11 },
                                    ]}
                                  >
                                    {payment.paymentMethod} • {payment.createdBy}
                                  </ThemedText>
                                </View>
                                <ThemedText
                                  type="defaultSemiBold"
                                  style={{ color: colors.primary, fontSize: 13 }}
                                >
                                  {formatIDR(payment.amount)}
                                </ThemedText>
                              </View>
                            )
                          )}
                        </View>
                      ) : (
                        <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                          No payment history available.
                        </ThemedText>
                      )}
                    </Card>
                  )}

                  {/* Items List – at the end */}
                  <Card style={styles.detailCard}>
                    <View style={styles.itemsHeader}>
                      <ThemedText type="subtitle" style={{ color: colors.text, fontSize: 14 }}>
                        Items
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.itemsCount,
                          { color: colors.icon, backgroundColor: colors.primary + "15" },
                        ]}
                      >
                        {transactionItems.length}
                      </ThemedText>
                    </View>
                    {loadingItems ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <ThemedText
                          style={[styles.loadingText, { color: colors.icon, marginTop: 8 }]}
                        >
                          Loading items...
                        </ThemedText>
                      </View>
                    ) : transactionItems.length === 0 ? (
                      <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                        No items found for this transaction. This may be an older transaction
                        created before item tracking was enabled.
                      </ThemedText>
                    ) : (
                      <View style={styles.itemsList}>
                        {transactionItems.map((item, index) => (
                          <View
                            key={item.id}
                            style={[
                              styles.compactItemRow,
                              index < transactionItems.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: colors.icon + "15",
                                paddingBottom: 10,
                                marginBottom: 10,
                              },
                            ]}
                          >
                            <View style={styles.compactItemInfo}>
                              <ThemedText
                                type="defaultSemiBold"
                                style={{ color: colors.text, fontSize: 13 }}
                                numberOfLines={2}
                              >
                                {item.barangNama}
                              </ThemedText>
                              <ThemedText
                                style={[
                                  styles.compactItemMeta,
                                  { color: colors.icon, fontSize: 11 },
                                ]}
                              >
                                {item.quantity} {item.barangUnit} × {formatIDR(item.unitPrice)}
                              </ThemedText>
                            </View>
                            <ThemedText
                              type="defaultSemiBold"
                              style={{ color: colors.text, fontSize: 13 }}
                            >
                              {formatIDR(item.totalPrice)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
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

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedTransaction && selectedTransaction.type === "grosir" && (
                <>
                  <Card style={styles.detailCard}>
                    <ThemedText style={{ color: colors.icon, marginBottom: 8, fontSize: 12 }}>
                      Remaining Balance
                    </ThemedText>
                    <ThemedText type="title" style={{ color: colors.error }}>
                      {formatIDR((selectedTransaction as JualanGrosir).sisaBonGrosir)}
                    </ThemedText>
                  </Card>

                  <Card style={styles.detailCard}>
                    <ThemedText style={{ color: colors.text, marginBottom: 8, fontSize: 12 }}>
                      Payment Amount
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.amountInput,
                        { backgroundColor: colors.background, color: colors.text },
                      ]}
                      value={paymentAmount}
                      onChangeText={(text) => {
                        const value = text.replace(/[^0-9]/g, "");
                        setPaymentAmount(value);
                      }}
                      placeholder="Enter amount"
                      placeholderTextColor={colors.icon}
                      keyboardType="numeric"
                    />
                  </Card>

                  <Card style={styles.detailCard}>
                    <ThemedText style={{ color: colors.text, marginBottom: 8, fontSize: 12 }}>
                      Payment Method
                    </ThemedText>
                    <View style={styles.paymentMethodsGrid}>
                      {(["Cash", "QRIS", "BNI", "BRI", "Mandiri"] as const).map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.paymentMethodButton,
                            {
                              backgroundColor:
                                paymentMethod === method ? colors.primary : colors.background,
                              borderColor:
                                paymentMethod === method ? colors.primary : colors.icon + "40",
                            },
                          ]}
                          onPress={() => setPaymentMethod(method)}
                        >
                          <ThemedText
                            style={[
                              styles.paymentMethodText,
                              {
                                color: paymentMethod === method ? "#FFFFFF" : colors.text,
                              },
                            ]}
                          >
                            {method}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>
                </>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount("");
                }}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Record Payment"
                onPress={handleAddPayment}
                loading={loadingItems}
                style={styles.modalButton}
                size="large"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Select {datePickerType === "start" ? "Start" : "End"} Date
              </ThemedText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerContent}>
              <View style={styles.nativeDatePickerContainer}>
                <ThemedText style={[styles.dateLabel, { color: colors.text, marginBottom: 16 }]}>
                  Select {datePickerType === "start" ? "Start" : "End"} Date
                </ThemedText>
                <TextInput
                  style={[
                    styles.dateInput,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  placeholder="YYYY-MM-DD"
                  value={dateInputValue}
                  onChangeText={(text) => {
                    // Format input as user types: YYYY-MM-DD
                    let formatted = text.replace(/[^0-9]/g, "");
                    if (formatted.length > 4) {
                      formatted = formatted.slice(0, 4) + "-" + formatted.slice(4);
                    }
                    if (formatted.length > 7) {
                      formatted = formatted.slice(0, 7) + "-" + formatted.slice(7, 9);
                    }
                    setDateInputValue(formatted);
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <ThemedText style={[styles.dateHint, { color: colors.icon, marginTop: 8 }]}>
                  Format: YYYY-MM-DD (e.g., 2026-01-11)
                </ThemedText>
                <View style={styles.datePickerButtons}>
                  <Button
                    title="Cancel"
                    onPress={() => setShowDatePicker(false)}
                    variant="outline"
                    style={styles.datePickerButton}
                  />
                  <Button
                    title="Confirm"
                    onPress={() => {
                      // Validate date format
                      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                      if (dateRegex.test(dateInputValue)) {
                        const selectedDate = new Date(dateInputValue);
                        if (!isNaN(selectedDate.getTime())) {
                          if (datePickerType === "start") {
                            selectedDate.setHours(0, 0, 0, 0);
                            setStartDate(selectedDate);
                          } else {
                            selectedDate.setHours(23, 59, 59, 999);
                            setEndDate(selectedDate);
                          }
                          setShowDatePicker(false);
                        } else {
                          Alert.alert("Invalid Date", "Please enter a valid date.");
                        }
                      } else {
                        Alert.alert("Invalid Format", "Please enter date in YYYY-MM-DD format.");
                      }
                    }}
                    style={styles.datePickerButton}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerTitle: {
    fontSize: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchIcon: {
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  additionalFilters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterSingleRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  filterTriggerHalf: {
    flex: 1,
  },
  filterLabelInline: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  filterTriggerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  filterTriggerText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  filterModalContent: {
    width: "100%",
    maxWidth: 320,
    maxHeight: "70%",
    borderRadius: 12,
    overflow: "hidden",
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  filterModalList: {
    maxHeight: 280,
    padding: 12,
  },
  filterCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  filterCheckboxLabel: {
    fontSize: 15,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: "row",
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 12,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  transactionCard: {
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  invoiceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  invoiceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  transactionDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    marginBottom: 2,
  },
  cashierName: {
    fontSize: 12,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  paymentMethod: {
    fontSize: 12,
    marginTop: 4,
  },
  grosirDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  grosirDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  grosirLabel: {
    fontSize: 12,
  },
  grosirValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  paymentModalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: "70%",
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  detailCard: {
    marginBottom: 12,
    padding: 12,
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  compactHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  compactHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "600",
  },
  compactHeaderRight: {
    alignItems: "flex-end",
  },
  compactDate: {
    fontSize: 11,
    marginTop: 2,
  },
  compactInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  compactInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: "30%",
  },
  compactInfoText: {
    fontSize: 12,
  },
  paymentSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  paymentSummaryLabel: {
    fontSize: 12,
  },
  paymentSummaryValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  itemsCount: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  itemsList: {
    marginTop: 4,
  },
  compactItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  compactItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  compactItemMeta: {
    marginTop: 3,
  },
  paymentHistoryList: {
    marginTop: 4,
  },
  compactPaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  compactPaymentInfo: {
    flex: 1,
    marginRight: 12,
  },
  compactPaymentDate: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  compactPaymentMethod: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: "center",
    padding: 20,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paymentInfo: {
    flex: 1,
    marginRight: 12,
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  paymentHistoryMethod: {
    fontSize: 12,
  },
  actionButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButtonsWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  actionButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButtonHalf: {
    flex: 1,
  },
  addPaymentButton: {
    width: "100%",
  },
  amountInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  paymentMethodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  modalButton: {
    flex: 1,
  },
  dateFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 6,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dateSeparator: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  resetDateButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resetDateText: {
    fontSize: 12,
    fontWeight: "600",
  },
  datePickerModal: {
    maxHeight: "50%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  datePickerContent: {
    padding: 20,
  },
  webDateInputContainer: {
    width: "100%",
  },
  nativeDatePickerContainer: {
    width: "100%",
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  dateInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dateHint: {
    fontSize: 12,
  },
  datePickerButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  datePickerButton: {
    flex: 1,
  },
});
