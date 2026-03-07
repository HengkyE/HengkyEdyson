import { PrinterConnectModal } from '@/components/printer-connect-modal';
import { SalesCard } from '@/components/sales-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getAllJualanGrosir,
  getAllJualanKontan,
  getGrosirPaymentsByDateRange,
  getJualanGrosirByDateRange,
  getJualanKontanByDateRange,
} from '@/edysonpos/services/database';
import { thermalPrinter } from '@/edysonpos/services/thermal-printer';
import { formatIDR } from '@/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type PaymentBreakdown = Record<string, { total: number; count: number }>;

const DEFAULT_PAYMENT_KEYS = ['Cash', 'QRIS', 'BNI', 'BRI', 'Mandiri'];

function getDateRangeForFilter(dateFilter: 'today' | 'all', selectedDate: Date): { start: Date; end: Date } {
  if (dateFilter === 'all') {
    const start = new Date(2000, 0, 1, 0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SalesOverviewScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, profile } = useAuth();

  const [todaySales, setTodaySales] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [averageOrder, setAverageOrder] = useState(0);
  const [kontanSales, setKontanSales] = useState(0);
  const [grosirSales, setGrosirSales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({
    Cash: { total: 0, count: 0 },
    QRIS: { total: 0, count: 0 },
    BNI: { total: 0, count: 0 },
    Mandiri: { total: 0, count: 0 },
    BRI: { total: 0, count: 0 },
  });
  const [kontanPaymentBreakdown, setKontanPaymentBreakdown] = useState<PaymentBreakdown>({
    Cash: { total: 0, count: 0 },
    QRIS: { total: 0, count: 0 },
    BNI: { total: 0, count: 0 },
    Mandiri: { total: 0, count: 0 },
    BRI: { total: 0, count: 0 },
  });
  const [grosirSetorByPayment, setGrosirSetorByPayment] = useState<PaymentBreakdown>({
    Cash: { total: 0, count: 0 },
    QRIS: { total: 0, count: 0 },
    BNI: { total: 0, count: 0 },
    Mandiri: { total: 0, count: 0 },
    BRI: { total: 0, count: 0 },
  });
  const [grosirTotalSetor, setGrosirTotalSetor] = useState(0);
  const [grosirTotalSisa, setGrosirTotalSisa] = useState(0);
  const [cashierBreakdown, setCashierBreakdown] = useState<Record<string, { total: number; count: number }>>({});
  const [salesByCashier, setSalesByCashier] = useState<
    Record<string, Record<string, { total: number; count: number }>>
  >({});
  const [grosirBelumBayarByCashier, setGrosirBelumBayarByCashier] = useState<
    Record<string, number>
  >({});
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const [printing, setPrinting] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  useEffect(() => {
    loadSalesData();
  }, [dateFilter, selectedDate]);

  const loadSalesData = async () => {
    try {
      setLoading(true);
      const { start: paymentStart, end: paymentEnd } = getDateRangeForFilter(dateFilter, selectedDate);
      const [kontanData, grosirData, grosirPaymentsInRange] = await Promise.all([
        dateFilter === 'today' ? getJualanKontanByDateRange(paymentStart, paymentEnd) : getAllJualanKontan(),
        dateFilter === 'today' ? getJualanGrosirByDateRange(paymentStart, paymentEnd) : getAllJualanGrosir(),
        getGrosirPaymentsByDateRange(paymentStart, paymentEnd),
      ]);

      const totalKontan = kontanData.reduce((sum, sale) => sum + Number(sale.totalBelanja), 0);
      const totalGrosir = grosirData.reduce((sum, sale) => sum + sale.totalBelanja, 0);
      const totalSales = totalKontan + totalGrosir;
      const totalTransactions = kontanData.length + grosirData.length;
      const average = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      setTodaySales(totalSales);
      setTodayTransactions(totalTransactions);
      setAverageOrder(average);
      setKontanSales(totalKontan);
      setGrosirSales(totalGrosir);

      // Payment method breakdown (combined)
      const paymentStats: PaymentBreakdown = {
        Cash: { total: 0, count: 0 },
        QRIS: { total: 0, count: 0 },
        BNI: { total: 0, count: 0 },
        Mandiri: { total: 0, count: 0 },
        BRI: { total: 0, count: 0 },
      };

      // Kontan-only breakdown (cash sales by payment method)
      const kontanStats: PaymentBreakdown = {
        Cash: { total: 0, count: 0 },
        QRIS: { total: 0, count: 0 },
        BNI: { total: 0, count: 0 },
        Mandiri: { total: 0, count: 0 },
        BRI: { total: 0, count: 0 },
      };
      kontanData.forEach((sale) => {
        const method = (sale.caraPembayaran || 'Cash').trim() || 'Cash';
        const key = DEFAULT_PAYMENT_KEYS.includes(method) ? method : method;
        if (!kontanStats[key]) kontanStats[key] = { total: 0, count: 0 };
        kontanStats[key].total += Number(sale.totalBelanja);
        kontanStats[key].count += 1;
        const pKey = DEFAULT_PAYMENT_KEYS.includes(method) ? method : 'Cash';
        if (!paymentStats[pKey]) paymentStats[pKey] = { total: 0, count: 0 };
        paymentStats[pKey].total += Number(sale.totalBelanja);
        paymentStats[pKey].count += 1;
      });

      // Grosir payment received (by payment date): from grosirPayments in range
      let totalSetor = 0;
      const grosirSetorStats: PaymentBreakdown = {
        Cash: { total: 0, count: 0 },
        QRIS: { total: 0, count: 0 },
        BNI: { total: 0, count: 0 },
        Mandiri: { total: 0, count: 0 },
        BRI: { total: 0, count: 0 },
      };
      grosirPaymentsInRange.forEach((p) => {
        totalSetor += p.amount;
        const method = (p.paymentMethod || 'Cash').trim() || 'Cash';
        const key = DEFAULT_PAYMENT_KEYS.includes(method) ? method : method;
        if (!grosirSetorStats[key]) grosirSetorStats[key] = { total: 0, count: 0 };
        grosirSetorStats[key].total += p.amount;
        grosirSetorStats[key].count += 1;
      });
      // Grosir total sisa: sum of sisaBonGrosir from sales in period (by sales date)
      const totalSisa = grosirData.reduce((sum, sale) => sum + Number(sale.sisaBonGrosir ?? 0), 0);
      // Combined payment breakdown still includes grosir sales (by sale) for display
      grosirData.forEach((sale) => {
        const pKey = (sale.caraPembayaran || 'Cash').trim() || 'Cash';
        if (!paymentStats[pKey]) paymentStats[pKey] = { total: 0, count: 0 };
        paymentStats[pKey].total += sale.totalBelanja;
        paymentStats[pKey].count += 1;
      });

      setPaymentBreakdown(paymentStats);
      setKontanPaymentBreakdown(kontanStats);
      setGrosirSetorByPayment(grosirSetorStats);
      setGrosirTotalSetor(totalSetor);
      setGrosirTotalSisa(totalSisa);

      // Calculate cashier breakdown
      // salesByCashier: only PAID amounts (kontan full, grosir setor only). Unpaid grosir shown separately as Grosir Belum Bayar.
      const cashierStats: Record<string, { total: number; count: number }> = {};
      const byCashier: Record<string, Record<string, { total: number; count: number }>> = {};
      const grosirBelumBayarByCashier: Record<string, number> = {};

      kontanData.forEach((sale) => {
        const cashier = sale.namaKasir || 'Unknown';
        const method = (sale.caraPembayaran || 'Cash').trim() || 'Cash';

        if (!cashierStats[cashier]) cashierStats[cashier] = { total: 0, count: 0 };
        cashierStats[cashier].total += Number(sale.totalBelanja);
        cashierStats[cashier].count += 1;

        if (!byCashier[cashier]) byCashier[cashier] = {};
        if (!byCashier[cashier][method]) byCashier[cashier][method] = { total: 0, count: 0 };
        byCashier[cashier][method].total += Number(sale.totalBelanja);
        byCashier[cashier][method].count += 1;
      });

      grosirData.forEach((sale) => {
        const cashier = sale.namaKasir || 'Unknown';
        const method = (sale.caraPembayaran || 'Cash').trim() || 'Cash';
        const setor = Number(sale.setorGrosir ?? 0);
        const sisa = Number(sale.sisaBonGrosir ?? 0);

        // Only count paid portion (setor) in sales total
        if (setor > 0) {
          if (!cashierStats[cashier]) cashierStats[cashier] = { total: 0, count: 0 };
          cashierStats[cashier].total += setor;
          cashierStats[cashier].count += 1;

          if (!byCashier[cashier]) byCashier[cashier] = {};
          if (!byCashier[cashier][method]) byCashier[cashier][method] = { total: 0, count: 0 };
          byCashier[cashier][method].total += setor;
          byCashier[cashier][method].count += 1;
        }

        // Track unpaid grosir (Grosir Belum Bayar) per cashier
        if (sisa > 0) {
          grosirBelumBayarByCashier[cashier] = (grosirBelumBayarByCashier[cashier] || 0) + sisa;
        }
      });

      setCashierBreakdown(cashierStats);
      setSalesByCashier(byCashier);
      setGrosirBelumBayarByCashier(grosirBelumBayarByCashier);
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSummary = async () => {
    if (!thermalPrinter.isConnected()) {
      const msg = 'Printer not connected. Connect your printer in Settings first, then try again.';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Cannot Print\n\n' + msg);
      } else {
        Alert.alert('Cannot Print', msg);
      }
      return;
    }
    setPrinting(true);
    try {
      await thermalPrinter.printSalesOverviewReport({
        dateLabel: dateFilter === 'today' ? 'Hari Ini' : 'Semua Waktu',
        reportDate: dateFilter === 'today' ? selectedDate : undefined,
        printedAt: new Date(),
        printedBy: profile?.fullName || user?.email?.split('@')[0] || 'User',
        kontanTotal: kontanSales,
        kontanByPayment: kontanPaymentBreakdown,
        grosirTotal: grosirSales,
        grosirSetor: grosirTotalSetor,
        grosirSisa: grosirTotalSisa,
        grosirSetorByPayment,
        salesByCashier,
        grosirBelumBayarByCashier,
      });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Laporan berhasil dicetak.');
      } else {
        Alert.alert('Success', 'Report printed successfully.');
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to print report.';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Print Failed\n\n' + msg);
      } else {
        Alert.alert('Print Failed', msg);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Sales Overview
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Date Filter - date shown inside Today button, tap to change date */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            dateFilter === 'today' && { backgroundColor: colors.primary },
          ]}
          onPress={() => {
            if (dateFilter === 'today') {
              setDateInputValue(toYYYYMMDD(selectedDate));
              setShowDatePicker(true);
            } else {
              setDateFilter('today');
            }
          }}
        >
          <ThemedText
            style={[
              styles.filterText,
              { color: dateFilter === 'today' ? '#FFFFFF' : colors.text },
            ]}
            numberOfLines={1}
          >
            {dateFilter === 'today'
              ? isSameDay(selectedDate, new Date())
                ? `Today, ${formatDisplayDate(selectedDate)}`
                : formatDisplayDate(selectedDate)
              : 'Today'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            dateFilter === 'all' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setDateFilter('all')}>
          <ThemedText
            style={[
              styles.filterText,
              { color: dateFilter === 'all' ? '#FFFFFF' : colors.text },
            ]}>
            All Time
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.salesSection}>
          <SalesCard
            title={
              dateFilter === 'today'
                ? isSameDay(selectedDate, new Date())
                  ? "Today's Sales"
                  : `Sales for ${formatDisplayDate(selectedDate)}`
                : "Total Sales"
            }
            value={formatIDR(todaySales)}
            subtitle={`${todayTransactions} transactions`}
            icon="cash-outline"
            iconColor={colors.primaryLight}
            valueColor={colors.primary}
          />
          <SalesCard
            title="Average Order"
            value={formatIDR(averageOrder)}
            subtitle="Per transaction"
            icon="trending-up-outline"
            iconColor={colors.secondary + '80'}
            valueColor={colors.secondary}
          />
        </View>

        <View style={styles.salesSection}>
          <SalesCard
            title="Cash Sales"
            value={formatIDR(kontanSales)}
            subtitle="Jualan Kontan"
            imageSource={require('@/assets/images/buying.png')}
            valueColor={colors.success}
          />
          <SalesCard
            title="Wholesale Sales"
            value={formatIDR(grosirSales)}
            subtitle="Jualan Grosir (by sales date)"
            imageSource={require('@/assets/images/trade.svg')}
            valueColor={colors.accent}
          />
        </View>

        <Card style={styles.breakdownCard}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
            Grosir payment received (this period)
          </ThemedText>
          <ThemedText style={[styles.breakdownCount, { color: colors.icon, marginBottom: 12 }]}>
            Payments received on selected date(s)
          </ThemedText>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownInfo}>
              <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>
                Total setor
              </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
              {formatIDR(grosirTotalSetor)}
            </ThemedText>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownInfo}>
              <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>
                Total sisa (outstanding)
              </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={{ color: colors.error }}>
              {formatIDR(grosirTotalSisa)}
            </ThemedText>
          </View>
        </Card>

        {/* Payment Method Breakdown */}
        <Card style={styles.breakdownCard}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
            Payment Method Breakdown
          </ThemedText>
          {Object.entries(paymentBreakdown)
            .filter(([_, stats]) => stats.count > 0)
            .map(([method, stats]) => (
              <View key={method} style={styles.breakdownRow}>
                <View style={styles.breakdownInfo}>
                  <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>
                    {method}
                  </ThemedText>
                  <ThemedText style={[styles.breakdownCount, { color: colors.icon }]}>
                    {stats.count} transactions
                  </ThemedText>
                </View>
                <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                  {formatIDR(stats.total)}
                </ThemedText>
              </View>
            ))}
        </Card>

        {/* Cashier Breakdown */}
        {(Object.keys(cashierBreakdown).length > 0 || Object.keys(grosirBelumBayarByCashier).length > 0) && (
          <Card style={styles.breakdownCard}>
            <ThemedText type="subtitle" style={[styles.cardTitle, { color: colors.text }]}>
              Sales by Cashier
            </ThemedText>
            <ThemedText style={[styles.breakdownCount, { color: colors.icon, marginBottom: 12 }]}>
              Paid sales only; Grosir Belum Bayar shown separately
            </ThemedText>
            {Object.keys({ ...cashierBreakdown, ...grosirBelumBayarByCashier })
              .sort((a, b) => {
                const paidA = cashierBreakdown[a]?.total ?? 0;
                const paidB = cashierBreakdown[b]?.total ?? 0;
                return paidB - paidA;
              })
              .map((cashier) => (
                <View key={cashier}>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownInfo}>
                      <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>
                        {cashier.split('@')[0]}
                      </ThemedText>
                      <ThemedText style={[styles.breakdownCount, { color: colors.icon }]}>
                        {(cashierBreakdown[cashier]?.count ?? 0)} transactions (paid)
                      </ThemedText>
                    </View>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                      {formatIDR(cashierBreakdown[cashier]?.total ?? 0)}
                    </ThemedText>
                  </View>
                  {(grosirBelumBayarByCashier[cashier] || 0) > 0 && (
                    <View style={[styles.breakdownRow, { paddingLeft: 16, borderBottomWidth: 0 }]}>
                      <ThemedText style={[styles.breakdownLabel, { color: colors.icon, fontSize: 13 }]}>
                        Grosir Belum Bayar
                      </ThemedText>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.error }}>
                        {formatIDR(grosirBelumBayarByCashier[cashier]!)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              ))}
          </Card>
        )}

        <Card style={styles.actionsCard}>
          <View style={styles.printerStatusRow}>
            <Ionicons
              name={thermalPrinter.isConnected() ? "checkmark-circle" : "close-circle"}
              size={20}
              color={thermalPrinter.isConnected() ? "#4CAF50" : colors.icon}
            />
            <ThemedText style={[styles.printerStatusText, { color: colors.text }]} numberOfLines={1}>
              Printer: {thermalPrinter.isConnected()
                ? thermalPrinter.getConnectionStatus().device?.name ?? "Connected"
                : "Not connected"}
            </ThemedText>
            <TouchableOpacity
              style={[styles.printerConnectButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowPrinterModal(true)}
            >
              <Ionicons name="print-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.printerConnectButtonText}>
                {thermalPrinter.isConnected() ? "Change" : "Connect"}
              </ThemedText>
            </TouchableOpacity>
          </View>
          <Button
            title={printing ? 'Printing...' : 'Print Sales Summary'}
            onPress={handlePrintSummary}
            loading={printing}
            disabled={printing}
            icon={<Ionicons name="print-outline" size={20} color="#FFFFFF" />}
            style={{ marginTop: 12 }}
          />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/transactions')}>
            <Ionicons name="list-outline" size={24} color={colors.primary} />
            <ThemedText style={[styles.actionText, { color: colors.text }]}>
              View All Transactions
            </ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { marginTop: 12 }]}
            onPress={() => router.push('/sales/grosir-invoices')}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <ThemedText style={[styles.actionText, { color: colors.text }]}>
              Manage Grosir Invoices
            </ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      <PrinterConnectModal
        visible={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.datePickerOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.datePickerHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Change date
              </ThemedText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <ThemedText style={[styles.dateLabel, { color: colors.text }]}>
                Select date
              </ThemedText>
              {Platform.OS === 'web' ? (
                <View style={styles.webDatePickerWrap}>
                  <input
                    type="date"
                    value={dateInputValue}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      setDateInputValue(v);
                      if (v) {
                        const d = new Date(v);
                        if (!isNaN(d.getTime())) {
                          d.setHours(0, 0, 0, 0);
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
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </View>
              ) : (
                <>
                  <TextInput
                    style={[
                      styles.dateInput,
                      { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon + '40' },
                    ]}
                    placeholder="YYYY-MM-DD"
                    value={dateInputValue}
                    onChangeText={(text) => {
                      let formatted = text.replace(/[^0-9]/g, '');
                      if (formatted.length > 4) formatted = formatted.slice(0, 4) + '-' + formatted.slice(4);
                      if (formatted.length > 7) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7, 9);
                      setDateInputValue(formatted);
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <ThemedText style={[styles.dateHint, { color: colors.icon }]}>
                    Format: YYYY-MM-DD (e.g. 2026-01-15)
                  </ThemedText>
                </>
              )}
              <View style={styles.datePickerButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setShowDatePicker(false)}
                  variant="outline"
                  style={styles.datePickerButton}
                />
                <Button
                  title="Apply"
                  onPress={() => {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (dateRegex.test(dateInputValue)) {
                      const d = new Date(dateInputValue);
                      if (!isNaN(d.getTime())) {
                        d.setHours(0, 0, 0, 0);
                        setSelectedDate(d);
                        setShowDatePicker(false);
                      } else {
                        Alert.alert('Invalid Date', 'Please enter a valid date.');
                      }
                    } else {
                      Alert.alert('Invalid Format', 'Please enter date in YYYY-MM-DD format.');
                    }
                  }}
                  style={styles.datePickerButton}
                />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
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
  salesSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionsCard: {
    marginTop: 8,
  },
  printerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  printerStatusText: {
    flex: 1,
    fontSize: 14,
  },
  printerConnectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  printerConnectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  datePickerContent: {
    padding: 20,
  },
  webDatePickerWrap: {
    marginBottom: 16,
    width: '100%',
  },
  dateLabel: {
    fontSize: 15,
    marginBottom: 8,
  },
  dateInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  dateHint: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerButton: {
    flex: 1,
  },
  breakdownCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  breakdownCount: {
    fontSize: 12,
  },
});

