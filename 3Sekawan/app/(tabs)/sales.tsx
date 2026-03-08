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

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { SalesCard } from "@/components/sales-card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Database } from "@/lib/database.types";
import { getBilliardSessions, getShopExpenses } from "@/services/billiardAndExpenses";
import { thermalPrinter } from "@/services/thermal-printer";
import {
  sendBilliardSalesDetailPDFToTelegram,
  sendBilliardSalesSummaryPDFToTelegram,
} from "@/services/telegram";
import { formatIDR } from "@/utils/currency";
import {
  addDaysInJakarta,
  formatDateTimeIndo,
  getJakartaDateParts,
  getJakartaMoment,
  getJakartaYYYYMMDD,
  getOperationalDayInJakarta,
  parseDateAsJakarta,
} from "@/utils/date";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["shop_expenses"]["Row"];

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  cleaning: "Kebersihan",
  wages: "Gaji Karyawan",
  utilities: "Listrik / Air",
  supplies: "Perlengkapan",
  maintenance: "Perbaikan",
  billiard: "Billiard",
  other: "Lainnya",
};

type DateRangePreset = "today" | "dateRange" | "month";

/** Operational day and date range use Asia/Jakarta (12:00–05:00 next day). */
function getDateRange(
  preset: DateRangePreset,
  baseDate: Date,
  rangeStart?: Date,
  rangeEnd?: Date,
  monthYear?: { month: number; year: number }
): { start: Date; end: Date } {
  let start: Date;
  let end: Date;

  if (preset === "dateRange" && rangeStart && rangeEnd) {
    const s = getJakartaDateParts(rangeStart);
    const e = getJakartaDateParts(rangeEnd);
    start = getJakartaMoment(s.year, s.month, s.day, 12, 0, 0);
    const nextEnd = new Date(e.year, e.month - 1, e.day + 1);
    end = getJakartaMoment(nextEnd.getFullYear(), nextEnd.getMonth() + 1, nextEnd.getDate(), 5, 0, 0);
  } else if (preset === "month" && monthYear) {
    const { month, year } = monthYear;
    start = getJakartaMoment(year, month, 1, 12, 0, 0);
    end = getJakartaMoment(year, month + 1, 1, 5, 0, 0);
  } else {
    const { year, month, day } = getJakartaDateParts(baseDate);
    start = getJakartaMoment(year, month, day, 12, 0, 0);
    const nextDay = new Date(year, month - 1, day + 1);
    end = getJakartaMoment(nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate(), 5, 0, 0);
  }

  return { start, end };
}

function normalizePaymentMethod(method: string | null): string {
  const m = (method || "cash").toLowerCase();
  if (m === "cash") return "Cash";
  if (m === "qris") return "QRIS";
  if (m === "qris_bni") return "BNI";
  if (m === "qris_mandiri") return "Mandiri";
  return m.toUpperCase();
}

function toYYYYMMDD(date: Date): string {
  return getJakartaYYYYMMDD(date);
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDDMMYYJakarta(date: Date): string {
  const { year, month, day } = getJakartaDateParts(date);
  return `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${String(year).slice(-2)}`;
}

export default function SalesReportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useLanguage();
  const { user } = useAuth();
  const defaultOperationalDate = useMemo(() => getOperationalDayInJakarta(), []);

  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [selectedDate, setSelectedDate] = useState<Date>(defaultOperationalDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState(toYYYYMMDD(defaultOperationalDate));
  const [rangeStartDate, setRangeStartDate] = useState<Date>(() =>
    addDaysInJakarta(defaultOperationalDate, -6)
  );
  const [rangeEndDate, setRangeEndDate] = useState<Date>(defaultOperationalDate);
  const [rangeStartInput, setRangeStartInput] = useState(() =>
    toYYYYMMDD(addDaysInJakarta(defaultOperationalDate, -6))
  );
  const [rangeEndInput, setRangeEndInput] = useState(() =>
    toYYYYMMDD(defaultOperationalDate)
  );
  const defaultParts = useMemo(() => getJakartaDateParts(defaultOperationalDate), [defaultOperationalDate]);
  const [selectedMonth, setSelectedMonth] = useState(defaultParts.month);
  const [selectedYear, setSelectedYear] = useState(defaultParts.year);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [yearInputValue, setYearInputValue] = useState(String(defaultParts.year));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingSummary, setPrintingSummary] = useState(false);
  const [printingTableSummary, setPrintingTableSummary] = useState(false);
  const [sendingPdfSummary, setSendingPdfSummary] = useState(false);
  const [sendingPdfDetails, setSendingPdfDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(
    () =>
      getDateRange(
        preset,
        selectedDate,
        rangeStartDate,
        rangeEndDate,
        preset === "month" ? { month: selectedMonth, year: selectedYear } : undefined
      ),
    [preset, selectedDate, rangeStartDate, rangeEndDate, selectedMonth, selectedYear]
  );

  useEffect(() => {
    loadSessions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, selectedDate, rangeStartDate, rangeEndDate, selectedMonth, selectedYear]);

  const loadSessions = async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // We want to group sales by when the game actually ENDED (started_at + duration_hours),
      // not by when the payment was recorded (paid_at), to avoid discrepancies.
      // To keep the query bounded, we fetch paid sessions that STARTED in a slightly wider window
      // (start - 1 day, end + 1 day) and then filter by computed end time on the client.
      const dayMs = 24 * 60 * 60 * 1000;
      const startBuffer = new Date(start.getTime() - dayMs);
      const endBuffer = new Date(end.getTime() + dayMs);

      const allSessions = await getBilliardSessions();
      const rawSessions = (allSessions ?? []).filter(
        (s) =>
          s.status === "paid" &&
          s.started_at >= startBuffer.toISOString() &&
          s.started_at <= endBuffer.toISOString()
      ) as SessionRow[];

      // Filter sessions by their actual end time: started_at + duration_hours
      const filteredByEndTime = rawSessions.filter((session) => {
        const startAt = new Date(session.started_at);
        const hours = Number(session.duration_hours || 0);
        if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(hours)) {
          return false;
        }
        const endAtMs = startAt.getTime() + hours * 3_600_000;
        const endAt = new Date(endAtMs);
        return endAt >= start && endAt <= end;
      });

      setSessions(filteredByEndTime);

      // Load expenses for the same date range
      const startDateStr = toYYYYMMDD(start);
      const endDateStr = toYYYYMMDD(end);
      const allExpenses = await getShopExpenses();
      const expensesFiltered = (allExpenses ?? []).filter(
        (e) => e.expense_date >= startDateStr && e.expense_date <= endDateStr
      );
      const expensesSorted = expensesFiltered.sort(
        (a, b) =>
          new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime() ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setExpenses(expensesSorted as ExpenseRow[]);
    } catch (err: any) {
      console.error("Unexpected error loading sessions:", err);
      setError(err?.message ?? "Failed to load sales data");
      setSessions([]);
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const summary = useMemo(() => {
    if (!sessions.length) {
      return {
        totalRevenue: 0,
        totalSessions: 0,
        byPaymentMethod: {} as Record<string, { count: number; total: number }>,
      };
    }

    const byPaymentMethod: Record<string, { count: number; total: number }> = {};
    let totalRevenue = 0;

    for (const session of sessions) {
      const amount = Number(session.rate_per_hour) * Number(session.duration_hours || 0);
      totalRevenue += amount;

      const method = normalizePaymentMethod(session.payment_method);
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, total: 0 };
      }
      byPaymentMethod[method].count += 1;
      byPaymentMethod[method].total += amount;
    }

    return {
      totalRevenue,
      totalSessions: sessions.length,
      byPaymentMethod,
    };
  }, [sessions]);

  const tableSummary = useMemo(() => {
    const byTable: Record<number, { sessions: number; totalHours: number; totalSales: number }> =
      {};

    for (const session of sessions) {
      const tableNumber = Number(session.table_number);
      const hours = Number(session.duration_hours || 0);
      const sales = Number(session.rate_per_hour) * hours;
      if (!byTable[tableNumber]) {
        byTable[tableNumber] = { sessions: 0, totalHours: 0, totalSales: 0 };
      }
      byTable[tableNumber].sessions += 1;
      byTable[tableNumber].totalHours += hours;
      byTable[tableNumber].totalSales += sales;
    }

    const rows = Object.entries(byTable)
      .map(([tableNumber, row]) => ({
        tableNumber: Number(tableNumber),
        sessions: row.sessions,
        totalHours: row.totalHours,
        totalSales: row.totalSales,
      }))
      .sort((a, b) => a.tableNumber - b.tableNumber);

    return {
      rows,
      grandTotalHours: rows.reduce((sum, row) => sum + row.totalHours, 0),
      grandTotalSales: rows.reduce((sum, row) => sum + row.totalSales, 0),
      grandTotalSessions: rows.reduce((sum, row) => sum + row.sessions, 0),
    };
  }, [sessions]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [expenses]
  );

  const getExpenseCategoryLabel = (id: string) =>
    EXPENSE_CATEGORY_LABELS[id] ?? id;

  const handleRefresh = () => {
    loadSessions(true);
  };

  const handlePrintSummary = async () => {
    if (printingSummary) return;
    setPrintingSummary(true);
    try {
      if (!thermalPrinter.isConnected()) {
        await thermalPrinter.testConnection();
      }

      const kontanByPayment: Record<string, { total: number; count: number }> = {};
      Object.entries(summary.byPaymentMethod).forEach(([method, stats]) => {
        kontanByPayment[method] = { total: stats.total, count: stats.count };
      });

      await thermalPrinter.printSalesOverviewReport({
        reportType: "billiard",
        dateLabel: rangeLabel,
        printedAt: new Date(),
        printedBy: user?.email?.split("@")[0] || "Kasir",
        kontanTotal: summary.totalRevenue,
        kontanByPayment,
        grosirTotal: 0,
        grosirSetor: 0,
        grosirSisa: 0,
        grosirSetorByPayment: {},
      });
    } catch (printError) {
      console.warn("Failed to print sales summary:", printError);
    } finally {
      setPrintingSummary(false);
    }
  };

  const handlePrintTableSummary = async () => {
    if (printingTableSummary) return;
    setPrintingTableSummary(true);
    try {
      if (!thermalPrinter.isConnected()) {
        await thermalPrinter.testConnection();
      }

      await thermalPrinter.printBilliardTableSummaryReport({
        dateLabel: rangeLabel,
        printedAt: new Date(),
        printedBy: user?.email?.split("@")[0] || "Kasir",
        tables: tableSummary.rows,
        grandTotalHours: tableSummary.grandTotalHours,
        grandTotalSales: tableSummary.grandTotalSales,
        grandTotalSessions: tableSummary.grandTotalSessions,
      });
    } catch (printError) {
      console.warn("Failed to print table summary report:", printError);
    } finally {
      setPrintingTableSummary(false);
    }
  };

  const handleSendPdfSummary = async () => {
    if (sendingPdfSummary) return;
    setSendingPdfSummary(true);
    try {
      await sendBilliardSalesSummaryPDFToTelegram({
        fileTitle: telegramPdfTitle,
        dateLabel: rangeLabel,
        printedAt: new Date(),
        printedBy: user?.email?.split("@")[0] || "Kasir",
        showOperationalChart: isSingleOperationalDay,
        operationWindowStart: operationalChartWindow?.start.toISOString(),
        operationWindowEnd: operationalChartWindow?.end.toISOString(),
        totalRevenue: summary.totalRevenue,
        totalSessions: summary.totalSessions,
        totalExpenses,
        expenses: expenses.map((e) => ({
          category: getExpenseCategoryLabel(e.category),
          description: e.description,
          amount: Number(e.amount),
          expenseDate: e.expense_date,
        })),
        byPaymentMethod: summary.byPaymentMethod,
        tableSummary: tableSummary.rows,
        sessionDetails: sessions.map((session) => ({
          tableNumber: Number(session.table_number),
          startedAt: session.started_at,
          paidAt: session.paid_at,
          durationHours: Number(session.duration_hours || 0),
          ratePerHour: Number(session.rate_per_hour || 0),
          amount: Number(session.rate_per_hour || 0) * Number(session.duration_hours || 0),
          paymentMethod: normalizePaymentMethod(session.payment_method),
        })),
      });
    } catch (sendError) {
      console.warn("Failed to send PDF summary report:", sendError);
      const message = sendError instanceof Error ? sendError.message : "Failed to send PDF summary.";
      Alert.alert("Send PDF failed", message);
    } finally {
      setSendingPdfSummary(false);
    }
  };

  const handleSendPdfDetails = async () => {
    if (sendingPdfDetails) return;
    setSendingPdfDetails(true);
    try {
      await sendBilliardSalesDetailPDFToTelegram({
        fileTitle: telegramPdfTitle,
        dateLabel: rangeLabel,
        printedAt: new Date(),
        printedBy: user?.email?.split("@")[0] || "Kasir",
        sessionDetails: sessions.map((session) => ({
          tableNumber: Number(session.table_number),
          paidAt: session.paid_at,
          durationHours: Number(session.duration_hours || 0),
          ratePerHour: Number(session.rate_per_hour || 0),
          amount: Number(session.rate_per_hour || 0) * Number(session.duration_hours || 0),
          paymentMethod: normalizePaymentMethod(session.payment_method),
        })),
      });
    } catch (sendError) {
      console.warn("Failed to send PDF detail report:", sendError);
      const message = sendError instanceof Error ? sendError.message : "Failed to send PDF detail report.";
      Alert.alert("Send PDF failed", message);
    } finally {
      setSendingPdfDetails(false);
    }
  };

  const rangeLabel = useMemo(() => {
    const startStr = formatDateTimeIndo(start);
    const endStr = formatDateTimeIndo(end);
    return `${startStr} - ${endStr}`;
  }, [start, end]);

  const isSingleOperationalDay = useMemo(() => {
    if (preset === "month") return false;
    if (preset === "dateRange") {
      return toYYYYMMDD(rangeStartDate) === toYYYYMMDD(rangeEndDate);
    }
    return true;
  }, [preset, rangeStartDate, rangeEndDate]);

  const operationalChartWindow = useMemo(() => {
    if (!isSingleOperationalDay) return null;
    return {
      start: new Date(start.getTime() + 60 * 60 * 1000), // 13:00
      end: new Date(end.getTime() - 2 * 60 * 60 * 1000), // 03:00
    };
  }, [isSingleOperationalDay, start, end]);

  const telegramPdfTitle = useMemo(() => {
    if (preset === "month") {
      const monthDate = getJakartaMoment(selectedYear, selectedMonth, 1, 12, 0, 0);
      const monthNameRaw = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        month: "long",
      }).format(monthDate);
      const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);
      return `Laporan_${monthName}`;
    }

    if (preset === "dateRange") {
      const startTag = formatDDMMYYJakarta(rangeStartDate);
      const endTag = formatDDMMYYJakarta(rangeEndDate);
      return startTag === endTag ? `LaporanHarian_${startTag}` : `Laporan_${startTag}-${endTag}`;
    }

    return `LaporanHarian_${formatDDMMYYJakarta(selectedDate)}`;
  }, [preset, rangeStartDate, rangeEndDate, selectedDate, selectedMonth, selectedYear]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {/* Reuse translation if available; fallback English if not */}
            {t("home.salesOverview")}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            {user?.email ? user.email.split("@")[0] : "Kasir"}
          </ThemedText>
        </View>

        <Card>
          <View style={styles.filterHeader}>
            <ThemedText type="defaultSemiBold" style={[styles.filterTitle, { color: colors.text }]}>
              Laporan Penjualan Meja Billiard
            </ThemedText>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.refreshButton}
              disabled={refreshing || loading}
            >
              {refreshing || loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.presetRow}>
            <PresetChip
              label={formatDisplayDate(selectedDate)}
              active={preset === "today"}
              onPress={() => {
                if (preset === "today") {
                  setDateInputValue(toYYYYMMDD(selectedDate));
                  setShowDatePicker(true);
                } else {
                  setPreset("today");
                }
              }}
            />
            <PresetChip
              label={
                preset === "dateRange"
                  ? `${formatShortDate(rangeStartDate)} - ${formatShortDate(rangeEndDate)}`
                  : "Rentang Tanggal"
              }
              active={preset === "dateRange"}
              onPress={() => {
                if (preset === "dateRange") {
                  setRangeStartInput(toYYYYMMDD(rangeStartDate));
                  setRangeEndInput(toYYYYMMDD(rangeEndDate));
                  setShowDateRangePicker(true);
                } else {
                  setPreset("dateRange");
                  setRangeStartInput(toYYYYMMDD(rangeStartDate));
                  setRangeEndInput(toYYYYMMDD(rangeEndDate));
                  setShowDateRangePicker(true);
                }
              }}
            />
            <PresetChip
              label={
                preset === "month"
                  ? new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("id-ID", {
                      month: "short",
                      year: "numeric",
                    })
                  : "Bulan"
              }
              active={preset === "month"}
              onPress={() => {
                if (preset === "month") {
                  setShowMonthPicker(true);
                } else {
                  setPreset("month");
                  const parts = getJakartaDateParts(selectedDate);
                  setSelectedMonth(parts.month);
                  setSelectedYear(parts.year);
                  setYearInputValue(String(parts.year));
                  setShowMonthPicker(true);
                }
              }}
            />
          </View>

          <ThemedText style={[styles.rangeText, { color: colors.icon }]}>{rangeLabel}</ThemedText>
        </Card>

        <View style={styles.summaryRow}>
          <SalesCard
            title="Total Pendapatan"
            value={formatIDR(summary.totalRevenue)}
            subtitle={`${summary.totalSessions} sesi meja dibayar`}
            icon="cash-outline"
            iconColor={colors.primaryLight}
            valueColor={colors.primary}
          />
          <SalesCard
            title="Total Pengeluaran"
            value={formatIDR(totalExpenses)}
            subtitle={`${expenses.length} item pengeluaran`}
            icon="receipt-outline"
            iconColor="#dc2626"
            valueColor="#dc2626"
          />
        </View>
        <View style={styles.printButtonRow}>
          <TouchableOpacity
            style={[
              styles.printSummaryButton,
              { backgroundColor: colors.primary },
              printingSummary && styles.disabledButton,
            ]}
            onPress={handlePrintSummary}
            activeOpacity={0.8}
            disabled={printingSummary || loading}
          >
            <Ionicons name="print-outline" size={18} color="#fff" />
            <ThemedText style={styles.printSummaryButtonText}>
              {printingSummary ? "Printing Sales Report..." : "Print Sales Report"}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.printSummaryButton,
              { backgroundColor: colors.secondary },
              printingTableSummary && styles.disabledButton,
            ]}
            onPress={handlePrintTableSummary}
            activeOpacity={0.8}
            disabled={printingTableSummary || loading}
          >
            <Ionicons name="print-outline" size={18} color="#fff" />
            <ThemedText style={styles.printSummaryButtonText}>
              {printingTableSummary
                ? "Printing Table Summary..."
                : "Print Table Summary Report"}
            </ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.printButtonRow}>
          <TouchableOpacity
            style={[
              styles.printSummaryButton,
              { backgroundColor: colors.warning },
              sendingPdfSummary && styles.disabledButton,
            ]}
            onPress={handleSendPdfSummary}
            activeOpacity={0.8}
            disabled={sendingPdfSummary || loading}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <ThemedText style={styles.printSummaryButtonText}>
              {sendingPdfSummary ? "Sending PDF Summary..." : "PDF Summary Report"}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.printSummaryButton,
              { backgroundColor: colors.secondary },
              sendingPdfDetails && styles.disabledButton,
            ]}
            onPress={handleSendPdfDetails}
            activeOpacity={0.8}
            disabled={sendingPdfDetails || loading}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <ThemedText style={styles.printSummaryButtonText}>
              {sendingPdfDetails ? "Sending PDF Detail..." : "PDF Detail Sesi Dibayar"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {!!Object.keys(summary.byPaymentMethod).length && (
          <Card>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.sectionTitle, { color: colors.text }]}
            >
              Ringkasan per metode bayar
            </ThemedText>
            {Object.entries(summary.byPaymentMethod).map(([method, stats]) => (
              <View key={method} style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  <ThemedText style={[styles.paymentMethod, { color: colors.text }]}>
                    {method}
                  </ThemedText>
                  <ThemedText style={[styles.paymentCount, { color: colors.icon }]}>
                    {stats.count} sesi
                  </ThemedText>
                </View>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.paymentTotal, { color: colors.primary }]}
                >
                  {formatIDR(stats.total)}
                </ThemedText>
              </View>
            ))}
          </Card>
        )}

        <Card>
          <View style={styles.sectionHeader}>
            <ThemedText
              type="defaultSemiBold"
              style={[styles.sectionTitle, { color: colors.text }]}
            >
              Detail sesi meja
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: colors.icon }]}>
              {sessions.length} sesi ditemukan
            </ThemedText>
          </View>

          {loading ? (
            <SkeletonList count={4} />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={20} color={colors.error} />
              <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="information-circle-outline" size={24} color={colors.icon} />
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                Belum ada sesi meja yang dibayar pada rentang tanggal ini.
              </ThemedText>
            </View>
          ) : (
            sessions.map((session) => {
              const amount =
                Number(session.rate_per_hour) * Number(session.duration_hours || 0);
              const paidAtLabel = session.paid_at
                ? formatDateTimeIndo(session.paid_at)
                : "-";

              return (
                <View key={session.id} style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.tableLabel, { color: colors.text }]}
                    >
                      Meja {session.table_number}
                    </ThemedText>
                    <ThemedText style={[styles.sessionMeta, { color: colors.icon }]}>
                      Durasi: {Number(session.duration_hours || 0)} jam • Tarif:{" "}
                      {formatIDR(Number(session.rate_per_hour))}
                    </ThemedText>
                    <ThemedText style={[styles.sessionMeta, { color: colors.icon }]}>
                      Dibayar: {paidAtLabel}
                    </ThemedText>
                    <ThemedText style={[styles.sessionMeta, { color: colors.icon }]}>
                      Metode: {normalizePaymentMethod(session.payment_method)}
                    </ThemedText>
                  </View>
                  <View style={styles.sessionRight}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.amountText, { color: colors.primary }]}
                    >
                      {formatIDR(amount)}
                    </ThemedText>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

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
                Pilih tanggal laporan
              </ThemedText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              {Platform.OS === "web" ? (
                <View style={styles.webDatePickerWrap}>
                  <input
                    type="date"
                    value={dateInputValue}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      setDateInputValue(v);
                      if (v) {
                        const d = parseDateAsJakarta(v);
                        if (d) {
                          setSelectedDate(d);
                          setShowDatePicker(false);
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
                <>
                  <TextInput
                    style={[
                      styles.dateInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.icon + "40",
                      },
                    ]}
                    placeholder="YYYY-MM-DD"
                    value={dateInputValue}
                    onChangeText={(text) => {
                      let formatted = text.replace(/[^0-9]/g, "");
                      if (formatted.length > 4) formatted = formatted.slice(0, 4) + "-" + formatted.slice(4);
                      if (formatted.length > 7) formatted = formatted.slice(0, 7) + "-" + formatted.slice(7, 9);
                      setDateInputValue(formatted);
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
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
                        const d = parseDateAsJakarta(dateInputValue);
                        if (d) {
                          setSelectedDate(d);
                          setShowDatePicker(false);
                        }
                      }}
                    >
                      <ThemedText style={{ color: "#fff" }}>Terapkan</ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showDateRangePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDateRangePicker(false)}
      >
        <View style={styles.datePickerOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.datePickerHeader}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Pilih rentang tanggal
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowDateRangePicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Dari tanggal</ThemedText>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={rangeStartInput}
                  onChange={(e) => setRangeStartInput((e.target as HTMLInputElement).value)}
                  style={{
                    padding: 12,
                    fontSize: 16,
                    borderRadius: 8,
                    border: `1px solid ${colors.icon}40`,
                    width: "100%",
                    boxSizing: "border-box",
                    marginBottom: 12,
                  }}
                />
              ) : (
                <TextInput
                  style={[
                    styles.dateInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.icon + "40",
                      marginBottom: 12,
                    },
                  ]}
                  placeholder="YYYY-MM-DD"
                  value={rangeStartInput}
                  onChangeText={(t) => {
                    let f = t.replace(/[^0-9]/g, "");
                    if (f.length > 4) f = f.slice(0, 4) + "-" + f.slice(4);
                    if (f.length > 7) f = f.slice(0, 7) + "-" + f.slice(7, 9);
                    setRangeStartInput(f);
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />
              )}
              <ThemedText style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>
                Sampai tanggal
              </ThemedText>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={rangeEndInput}
                  onChange={(e) => setRangeEndInput((e.target as HTMLInputElement).value)}
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
                  style={[
                    styles.dateInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.icon + "40",
                    },
                  ]}
                  placeholder="YYYY-MM-DD"
                  value={rangeEndInput}
                  onChangeText={(t) => {
                    let f = t.replace(/[^0-9]/g, "");
                    if (f.length > 4) f = f.slice(0, 4) + "-" + f.slice(4);
                    if (f.length > 7) f = f.slice(0, 7) + "-" + f.slice(7, 9);
                    setRangeEndInput(f);
                  }}
                  keyboardType="numeric"
                  maxLength={10}
                />
              )}
              <View style={[styles.dateActions, { marginTop: 20 }]}>
                <TouchableOpacity
                  style={[styles.dateActionButton, { borderColor: colors.icon + "40" }]}
                  onPress={() => setShowDateRangePicker(false)}
                >
                  <ThemedText style={{ color: colors.text }}>Batal</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateActionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const d1 = new Date(rangeStartInput);
                    const d2 = new Date(rangeEndInput);
                    const j1 = parseDateAsJakarta(rangeStartInput);
                    const j2 = parseDateAsJakarta(rangeEndInput);
                    if (j1 && j2) {
                      if (j1 <= j2) {
                        setRangeStartDate(j1);
                        setRangeEndDate(j2);
                      } else {
                        setRangeStartDate(j2);
                        setRangeEndDate(j1);
                      }
                      setShowDateRangePicker(false);
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

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.datePickerOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.datePickerHeader}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Pilih bulan
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowMonthPicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              {Platform.OS === "web" ? (
                <input
                  type="month"
                  value={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`}
                  onChange={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    if (v) {
                      const [y, m] = v.split("-").map(Number);
                      setSelectedYear(y);
                      setSelectedMonth(m);
                      setShowMonthPicker(false);
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
              ) : (
                <>
                  <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Bulan</ThemedText>
                  <View style={styles.monthYearRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.monthChip,
                            selectedMonth === m && {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            },
                          ]}
                          onPress={() => setSelectedMonth(m)}
                        >
                          <ThemedText
                            style={[
                              styles.monthChipText,
                              { color: selectedMonth === m ? "#fff" : colors.text },
                            ]}
                          >
                            {new Date(2000, m - 1, 1).toLocaleString("id-ID", { month: "short" })}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <ThemedText style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>
                    Tahun
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.dateInput,
                      { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon + "40" },
                    ]}
                    placeholder="YYYY"
                    value={yearInputValue}
                    onChangeText={(t) => {
                      const digits = t.replace(/\D/g, "").slice(0, 4);
                      setYearInputValue(digits);
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <View style={[styles.dateActions, { marginTop: 20 }]}>
                    <TouchableOpacity
                      style={[styles.dateActionButton, { borderColor: colors.icon + "40" }]}
                      onPress={() => setShowMonthPicker(false)}
                    >
                      <ThemedText style={{ color: colors.text }}>Batal</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dateActionButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        const n = parseInt(yearInputValue, 10);
                        if (!Number.isNaN(n) && n >= 2020 && n <= 2030) {
                          setSelectedYear(n);
                        }
                        setShowMonthPicker(false);
                      }}
                    >
                      <ThemedText style={{ color: "#fff" }}>Terapkan</ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

interface PresetChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function PresetChip({ label, active, onPress }: PresetChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.cardBackground,
          borderColor: active ? colors.primary : colors.icon + "40",
        },
      ]}
      activeOpacity={0.7}
    >
      <ThemedText
        style={[
          styles.chipLabel,
          { color: active ? "#FFFFFF" : colors.text },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 999,
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rangeText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  printButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  printSummaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  printSummaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.7,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  paymentLeft: {
    flexDirection: "column",
    flex: 1,
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentCount: {
    fontSize: 12,
    marginTop: 2,
  },
  paymentTotal: {
    fontSize: 14,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 12,
  },
  sessionLeft: {
    flex: 1,
  },
  sessionRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  tableLabel: {
    fontSize: 15,
    marginBottom: 2,
  },
  sessionMeta: {
    fontSize: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
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
  closeButton: {
    padding: 4,
  },
  datePickerContent: {
    gap: 12,
  },
  webDatePickerWrap: {
    width: "100%",
  },
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
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  monthYearRow: {
    marginBottom: 8,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

