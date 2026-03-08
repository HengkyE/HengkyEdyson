import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CashPaymentCalculator } from "@/edysonpos/components/cash-payment-calculator";
import { PrinterConnectModal } from "@/components/printer-connect-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PaymentMethod } from "@/components/payment-method-selector";
import type { Database } from "@/lib/database.types";
import {
  getBilliardSessions,
  insertBilliardSession,
  updateBilliardSession,
} from "@/services/billiardAndExpenses";
import {
  calculateBilliardAmount,
  getBilliardPricingBreakdown,
  getRatePerHour,
} from "@/lib/pricing";
import { formatIDR } from "@/utils/currency";
import { thermalPrinter } from "@/services/thermal-printer";
import * as Network from "expo-network";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];
type SessionUpdate = Database["public"]["Tables"]["sessions"]["Update"];

const ALL_TABLES = Array.from({ length: 17 }, (_, i) => i + 1);
const TEN_MIN_MS = 10 * 60 * 1000;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  Cash: "Cash",
  QRIS: "QRIS",
  BNI: "QRIS BNI",
  Mandiri: "QRIS Mandiri",
};

// Values persisted into Supabase sessions.payment_method.
const PAYMENT_DB_VALUES: Record<PaymentMethod, string> = {
  Cash: "cash",
  QRIS: "qris",
  BNI: "qris_bni",
  Mandiri: "qris_mandiri",
};

function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "0:00";
  const totalSec = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBilledHours(startedAt: string, checkoutAt: Date): number {
  const elapsedMs = checkoutAt.getTime() - new Date(startedAt).getTime();
  const elapsedHours = Math.max(0, elapsedMs / 3_600_000);
  const roundedHalfHour = Math.ceil(elapsedHours * 2) / 2;
  return Math.max(1, roundedHalfHour);
}

export default function BilliardHomeScreen() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [startModalTable, setStartModalTable] = useState<number | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<SessionRow | null>(null);
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const [customHours, setCustomHours] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [chargeBasis, setChargeBasis] = useState<"booked" | "billed" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerLabel, setPrinterLabel] = useState<string>("Cek printer…");
  const [cashReceived, setCashReceived] = useState(0);
  const [extendSession, setExtendSession] = useState<SessionRow | null>(null);
  const [extendHours, setExtendHours] = useState<number | null>(null);
  /** When timer is off: add these hours to the session (extend) before paying. */
  const [checkoutAddHoursToSession, setCheckoutAddHoursToSession] = useState(0);
  const [addingExtendInCheckout, setAddingExtendInCheckout] = useState(false);
  const [showPrinterConnectModal, setShowPrinterConnectModal] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track tables that have already shown the 10-min warning so we alert only once
  const alertedTablesRef = useRef<Set<number>>(new Set());
  // Animated value for blinking effect (10 minutes warning)
  const blinkAnim = useRef(new Animated.Value(0)).current;

  // Helper: remaining milliseconds for a session
  const getRemainingMs = useCallback((s: SessionRow, currentTime: number): number => {
    const end =
      new Date(s.started_at).getTime() + Number(s.duration_hours || 0) * 3600 * 1000;
    return end - currentTime;
  }, []);

  const fetchSessions = useCallback(async () => {
    const data = await getBilliardSessions();
    const active = (data ?? []).filter((s) =>
      ["active", "timer_ended"].includes(s.status)
    );
    setSessions(active as SessionRow[]);
  }, []);

  const updatePrinterStatus = useCallback(() => {
    try {
      const status = thermalPrinter.getConnectionStatus();
      setPrinterConnected(status.connected);
      if (status.connected) {
        setPrinterLabel(status.device?.name || "Printer tersambung");
      } else {
        setPrinterLabel("Belum tersambung");
      }
    } catch (error) {
      console.warn("Failed to get printer status:", error);
      setPrinterConnected(false);
      setPrinterLabel("Belum tersambung");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSessions().finally(() => setLoading(false));
    updatePrinterStatus();
  }, [fetchSessions, updatePrinterStatus]);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Blinking animation for tables with 10 minutes or less remaining
  useEffect(() => {
    const TEN_MIN_MS = 10 * 60 * 1000;
    const hasWarningTable = sessions.some((s) => {
      const remaining = getRemainingMs(s, now);
      return remaining > 0 && remaining <= TEN_MIN_MS;
    });

    if (hasWarningTable) {
      // Start blinking animation loop
      const blinkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false, // backgroundColor doesn't support native driver
          }),
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      );
      blinkLoop.start();
      return () => blinkLoop.stop();
    } else {
      // Stop animation and reset to 0
      blinkAnim.setValue(0);
    }
  }, [sessions, now, getRemainingMs, blinkAnim]);

  const handlePrinterPress = useCallback(() => {
    setShowPrinterConnectModal(true);
  }, []);

  const updateTimerEnded = useCallback(
    async (session: SessionRow) => {
      await updateBilliardSession(session.id, { status: "timer_ended" });
      await fetchSessions();
    },
    [fetchSessions]
  );

  useEffect(() => {
    // Clean up alerted entries for tables that are no longer active
    const activeTableNums = new Set(sessions.map((s) => s.table_number));
    alertedTablesRef.current.forEach((tn) => {
      if (!activeTableNums.has(tn)) alertedTablesRef.current.delete(tn);
    });

    sessions.forEach((s) => {
      if (s.status !== "active") return;
      // Do not overwrite session that is currently being checked out (avoid race)
      if (checkoutSession && s.id === checkoutSession.id) return;
      const remaining = getRemainingMs(s, now);

      // 10-minute warning alert (fire once per session)
      if (
        remaining > 0 &&
        remaining <= TEN_MIN_MS &&
        !alertedTablesRef.current.has(s.table_number)
      ) {
        alertedTablesRef.current.add(s.table_number);
        const mins = Math.ceil(remaining / 60_000);
        Alert.alert(
          "⚠️ Peringatan Waktu",
          `Meja ${s.table_number} tersisa ${mins} menit lagi!`
        );
      }

      if (remaining <= 0) updateTimerEnded(s);
    });
  }, [now, sessions, getRemainingMs, updateTimerEnded, checkoutSession]);

  const sessionByTable = useMemo(
    () =>
      sessions.reduce<Record<number, SessionRow>>((acc, s) => {
        acc[s.table_number] = s;
        return acc;
      }, {}),
    [sessions]
  );

  const numColumns = 3;
  const cardWidth =
    (Dimensions.get("window").width - 24 * 2 - 12 * (numColumns - 1)) / numColumns;

  const { availableCount, activeCount, endedCount } = useMemo(
    () =>
      ALL_TABLES.reduce(
        (acc, tableNum) => {
          const session = sessionByTable[tableNum];
          if (!session) {
            acc.availableCount += 1;
          } else {
            const remainingMs = getRemainingMs(session, now);
            const isEnded = remainingMs <= 0;
            if (isEnded) acc.endedCount += 1;
            else acc.activeCount += 1;
          }
          return acc;
        },
        { availableCount: 0, activeCount: 0, endedCount: 0 }
      ),
    [sessionByTable, getRemainingMs, now]
  );

  const openStartModal = (tableNumber: number) => {
    setStartModalTable(tableNumber);
    setSelectedHours(null);
    setCustomHours("");
  };

  const confirmStart = async () => {
    if (startModalTable == null) return;
    const hours = selectedHours ?? (customHours ? parseFloat(customHours) : 0);
    if (!hours || hours <= 0 || hours > 24) return;
    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert("Sesi tidak valid. Silakan login kembali.");
        } else {
          Alert.alert("Gagal", "Sesi tidak valid. Silakan login kembali.");
        }
        return;
      }

      const startedAt = new Date().toISOString();
      const endAtIso = new Date(
        new Date(startedAt).getTime() + hours * 3_600_000
      ).toISOString();
      const rate = getRatePerHour(startModalTable, new Date(startedAt));

      const insertData: SessionInsert = {
        table_number: startModalTable,
        started_at: startedAt,
        duration_hours: hours,
        rate_per_hour: rate,
        status: "active",
        cashier_id: authUser.id,
      };
      const inserted = await insertBilliardSession({
        table_number: startModalTable!,
        started_at: startedAt,
        duration_hours: initialHours,
        rate_per_hour: rate,
        status: "active",
        cashier_id: authUser.id,
      });
      if (!inserted) {
        throw new Error("Meja gagal dimulai. Coba lagi.");
      }

      // Try to print a simple start receipt for this table.
      try {
        // Do not auto-connect printer during transaction flow.
        // User should connect manually from the Printer button.
        if (thermalPrinter.isConnected()) {
          await thermalPrinter.printBilliardStartReceipt({
            tableNumber: startModalTable,
            startAt: startedAt,
            endAt: endAtIso,
          });
        } else {
          console.log("Printer not connected, skipping start receipt print.");
        }
      } catch (printError) {
        console.warn("Failed to print billiard start receipt:", printError);
      }

      setStartModalTable(null);
      await fetchSessions();
    } catch (err: unknown) {
      console.error("Error starting billiard session:", err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal memulai meja. Periksa koneksi dan coba lagi.";
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Gagal Memulai Meja", message, [{ text: "OK" }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmExtend = async () => {
    if (!extendSession || !extendHours || extendHours <= 0 || extendHours > 24) return;
    setSubmitting(true);
    try {
      const currentHours = Number(extendSession.duration_hours || 0);
      const newDuration = currentHours + extendHours;

      await updateBilliardSession(extendSession.id, { duration_hours: newDuration });

      setExtendSession(null);
      setExtendHours(null);
      await fetchSessions();
    } catch (err: unknown) {
      console.error("Error extending billiard session:", err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal memperpanjang sesi. Periksa koneksi dan coba lagi.";
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Gagal Memperpanjang", message, [{ text: "OK" }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** From checkout modal when timer is off: add selected hours to session (extend), then refresh session in modal. */
  const applyCheckoutAddHoursToSession = async () => {
    if (!checkoutSession || checkoutAddHoursToSession <= 0) return;
    const currentHours = Number(checkoutSession.duration_hours || 0);
    const newDuration = currentHours + checkoutAddHoursToSession;
    setAddingExtendInCheckout(true);
    try {
      const updatedRow = await updateBilliardSession(checkoutSession.id, {
        duration_hours: newDuration,
        status: "active",
      });
      if (!updatedRow) throw new Error("Gagal menambah waktu ke sesi.");
      setCheckoutSession(updatedRow as SessionRow);
      setCheckoutAddHoursToSession(0);
      await fetchSessions();
    } catch (err: unknown) {
      console.error("Error adding hours to session in checkout:", err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal menambah waktu ke sesi. Coba lagi.";
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Gagal", message, [{ text: "OK" }]);
      }
    } finally {
      setAddingExtendInCheckout(false);
    }
  };

  const confirmCheckout = async () => {
    if (!checkoutSession || !paymentMethod || !chargeBasis) return;
    const bookedHours = Number(checkoutSession.duration_hours || 0);
    const billedHours = getBilledHours(checkoutSession.started_at, new Date());
    const baseChargeHours = chargeBasis === "booked" ? bookedHours : billedHours;
    const chargeHours = baseChargeHours;
    const sessionStartDate = new Date(checkoutSession.started_at);
    const chargeEndDate = new Date(sessionStartDate.getTime() + chargeHours * 3_600_000);
    const totalAmount = calculateBilliardAmount(
      checkoutSession.table_number,
      sessionStartDate,
      chargeEndDate
    );
    const pricingBreakdown = getBilliardPricingBreakdown(
      checkoutSession.table_number,
      sessionStartDate,
      chargeEndDate
    );
    const effectiveRatePerHour =
      chargeHours > 0 ? Math.round(totalAmount / chargeHours) : 0;
    // Validate cash payment
    if (paymentMethod === "Cash" && cashReceived < totalAmount) return;

    // Check connectivity before checkout so user knows if payment might not be recorded
    try {
      const netState = await Network.getNetworkStateAsync();
      const hasConnection = netState.isConnected === true;
      const internetReachable = netState.isInternetReachable !== false;
      if (!hasConnection || !internetReachable) {
        Alert.alert(
          "Tidak ada koneksi internet",
          "Checkout mungkin tidak tersimpan ke server. Periksa koneksi internet Anda dan coba lagi, atau tekan \"Coba tetap\" untuk mencoba.",
          [
            { text: "Batal", style: "cancel" },
            { text: "Coba tetap", onPress: () => runCheckout() },
          ]
        );
        return;
      }
    } catch (_) {
      // If network check fails, proceed with checkout (e.g. web or API unavailable)
    }

    await runCheckout();
  };

  const runCheckout = async () => {
    if (!checkoutSession || !paymentMethod || !chargeBasis) return;
    const bookedHours = Number(checkoutSession.duration_hours || 0);
    const billedHours = getBilledHours(checkoutSession.started_at, new Date());
    const baseChargeHours = chargeBasis === "booked" ? bookedHours : billedHours;
    const chargeHours = baseChargeHours;
    const sessionStartDate = new Date(checkoutSession.started_at);
    const chargeEndDate = new Date(sessionStartDate.getTime() + chargeHours * 3_600_000);
    const totalAmount = calculateBilliardAmount(
      checkoutSession.table_number,
      sessionStartDate,
      chargeEndDate
    );
    const pricingBreakdown = getBilliardPricingBreakdown(
      checkoutSession.table_number,
      sessionStartDate,
      chargeEndDate
    );
    const effectiveRatePerHour =
      chargeHours > 0 ? Math.round(totalAmount / chargeHours) : 0;
    if (paymentMethod === "Cash" && cashReceived < totalAmount) return;

    setSubmitting(true);
    try {
      const paymentMethodDb = PAYMENT_DB_VALUES[paymentMethod];

      const updatedRow = await updateBilliardSession(checkoutSession.id, {
        status: "paid",
        duration_hours: chargeHours,
        rate_per_hour: effectiveRatePerHour,
        paid_at: new Date().toISOString(),
        payment_method: paymentMethodDb,
      });
      if (!updatedRow) {
        throw new Error(
          "Pembayaran tidak tersimpan. Pastikan Anda masuk (login) dan coba lagi."
        );
      }
      const updated = updatedRow as { id: string; status: string; paid_at: string | null };
      if (updated.status !== "paid") {
        console.error("Checkout update did not set status=paid. Got:", updated.status);
        throw new Error(
          "Status pembayaran tidak tersimpan (masih " + updated.status + "). Coba lagi atau periksa koneksi."
        );
      }

      // In future we could also record this into a separate sales table if needed
      console.log("Billiard session paid:", {
        table: checkoutSession.table_number,
        totalAmount,
        paymentMethod,
      });

      // Attempt to print billiard payment receipt
      try {
        const cashierName =
          profile?.fullName || user?.email?.split("@")[0] || "Kasir";
        const startDate = sessionStartDate;
        const endDate = chargeEndDate;
        const isCash = paymentMethod === "Cash";
        const change = isCash ? Math.max(0, cashReceived - totalAmount) : 0;

        // Do not auto-connect printer during transaction flow.
        // User should connect manually from the Printer button.
        if (thermalPrinter.isConnected()) {
          await thermalPrinter.printBilliardPaymentReceipt({
            tableNumber: checkoutSession.table_number,
            cashierName,
            paymentMethod: PAYMENT_LABELS[paymentMethod],
            hours: chargeHours,
            ratePerHour: effectiveRatePerHour,
            totalAmount,
            pricingBreakdown,
            startAt: startDate.toISOString(),
            endAt: endDate.toISOString(),
            cashReceived: isCash ? cashReceived : undefined,
            changeAmount: isCash ? change : undefined,
          });
        } else {
          console.log("Printer not connected, skipping payment receipt print.");
        }
      } catch (printError) {
        console.warn("Failed to print billiard payment receipt:", printError);
      }

      setCheckoutSession(null);
      setPaymentMethod(null);
      setChargeBasis(null);
      setCashReceived(0);
      setCheckoutAddHoursToSession(0);
      await fetchSessions();
    } catch (err: unknown) {
      console.error("Error completing billiard checkout:", err);
      let message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Pembayaran gagal. Periksa koneksi dan coba lagi.";
      const isLikelyNetwork =
        /network|fetch|internet|connection|timeout|unreachable/i.test(message) ||
        message === "Failed to fetch";
      if (isLikelyNetwork) {
        message =
          "Checkout tidak tersimpan. Periksa koneksi internet Anda dan coba lagi.";
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Checkout Gagal", message, [{ text: "OK" }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="ellipse" size={24} color={colors.primary} />
          </View>
          <View>
            <ThemedText type="title" style={styles.headerTitle}>
              Billiard
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: colors.icon }]}>
              {user?.email ? user.email.split("@")[0] : t("home.appName")}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.printerPill,
            printerConnected && styles.printerPillConnected,
            Platform.OS === "web" && styles.printerPillWeb,
          ]}
          onPress={handlePrinterPress}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons
            name={printerConnected ? "checkmark-circle" : "close-circle"}
            size={16}
            color={printerConnected ? "#fff" : "#666"}
            style={{ marginRight: 6 }}
          />
          <ThemedText
            style={[
              styles.printerPillText,
              printerConnected && { color: "#fff" },
            ]}
          >
            {printerConnected
              ? `Printer: ${printerLabel}`
              : "Printer: Belum tersambung"}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryHeader}>
          <Ionicons name="stats-chart" size={20} color={colors.text} style={{ marginRight: 8 }} />
          <ThemedText type="defaultSemiBold" style={styles.summaryTitle}>
            Ringkasan meja
          </ThemedText>
        </View>
        <View style={styles.summaryChips}>
          <View style={[styles.summaryChip, styles.summaryChipActive]}>
            <View style={styles.summaryChipIconContainer}>
              <Ionicons name="time" size={18} color="#14a44d" />
            </View>
            <View style={styles.summaryChipContent}>
              <ThemedText style={styles.summaryChipLabel}>Terpakai</ThemedText>
              <ThemedText style={[styles.summaryChipValue, { color: "#14a44d" }]}>
                {activeCount}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.summaryChip, styles.summaryChipAvailable]}>
            <View style={styles.summaryChipIconContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#3b71ca" />
            </View>
            <View style={styles.summaryChipContent}>
              <ThemedText style={styles.summaryChipLabel}>Tersedia</ThemedText>
              <ThemedText style={[styles.summaryChipValue, { color: "#3b71ca" }]}>
                {availableCount}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.summaryChip, styles.summaryChipEnded]}>
            <View style={styles.summaryChipIconContainer}>
              <Ionicons name="alert-circle" size={18} color="#dc4c64" />
            </View>
            <View style={styles.summaryChipContent}>
              <ThemedText style={styles.summaryChipLabel}>Butuh bayar</ThemedText>
              <ThemedText style={[styles.summaryChipValue, { color: "#dc4c64" }]}>
                {endedCount}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={{ marginTop: 12, color: colors.icon }}>
            Memuat meja…
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
          {ALL_TABLES.map((tableNum) => {
            const session = sessionByTable[tableNum];
            const remainingMs = session ? getRemainingMs(session, now) : 0;
            // Use remaining time for card color so extended sessions show green when time left
            const isEnded = session && remainingMs <= 0;
            const endAt = session
              ? new Date(
                  new Date(session.started_at).getTime() +
                    Number(session.duration_hours || 0) * 3600 * 1000
                ).toISOString()
              : null;

            const TEN_MIN_MS = 10 * 60 * 1000;
            const isWarningTime = session && !isEnded && remainingMs > 0 && remainingMs <= TEN_MIN_MS;
            
            let cardColor = colors.primary; // tersedia / tidak terpakai (default button color)
            if (session) {
              if (isEnded) cardColor = colors.error; // selesai
              else if (!isWarningTime) cardColor = colors.success; // sedang sesi
            }
            const cardTextColor = !session || isEnded ? "#fff" : "#000";

            // Interpolate between yellow and blue for warning state
            const animatedBgColor = isWarningTime
              ? blinkAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["#FFD700", "#3b71ca"], // Yellow to Blue
                })
              : cardColor;

            return (
              <Pressable
                key={tableNum}
                onPress={() => {
                  if (!session) openStartModal(tableNum);
                  else if (isEnded) {
                    setCheckoutSession(session);
                    setPaymentMethod(null);
                    setChargeBasis("booked");
                    setCashReceived(0);
                  } else {
                    // Active session: open extend/checkout options modal
                    setExtendSession(session);
                    setExtendHours(null);
                  }
                }}
              >
                <Animated.View
                  style={[
                    styles.card,
                    { width: cardWidth, backgroundColor: isWarningTime ? animatedBgColor : cardColor },
                  ]}
                >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardStatusIcon, { backgroundColor: cardTextColor + "20" }]}>
                    <Ionicons
                      name={
                        !session
                          ? "ellipse-outline"
                          : isEnded
                            ? "alert-circle"
                            : "time"
                      }
                      size={20}
                      color={cardTextColor}
                    />
                  </View>
                  <ThemedText style={[styles.cardTitle, { color: cardTextColor }]}>
                    Meja {tableNum}
                  </ThemedText>
                </View>
                {session && (
                  <>
                    <ThemedText style={[styles.cardTimer, { color: cardTextColor }]}>
                      {remainingMs <= 0 ? "Waktu habis" : formatRemaining(remainingMs)}
                    </ThemedText>
                    {endAt && (
                      <ThemedText style={[styles.cardInfo, { color: cardTextColor }]}>
                        Dari {formatClock(session.started_at)} {"->"} {formatClock(endAt)}
                      </ThemedText>
                    )}
                    {!endAt && (
                      <ThemedText style={[styles.cardInfo, { color: cardTextColor }]}>
                        Dari {formatClock(session.started_at)}
                      </ThemedText>
                    )}
                  </>
                )}
                </Animated.View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Start session modal */}
      <Modal visible={startModalTable != null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setStartModalTable(null)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="title" style={styles.modalTitle}>
              Mulai Meja {startModalTable}
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>Pilih durasi (jam)</ThemedText>
            <View style={styles.hoursRow}>
              {[1, 1.5, 2, 2.5, 3, 3.5].map((h) => (
                <Pressable
                  key={h}
                  style={[styles.hourChip, selectedHours === h && styles.hourChipActive]}
                  onPress={() => {
                    setSelectedHours(h);
                    setCustomHours("");
                  }}
                >
                  <ThemedText style={styles.hourChipText}>{h}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={styles.modalSubtitle}>Atau custom (jam)</ThemedText>
            <TextInput
              style={styles.input}
              value={customHours}
              onChangeText={(t) => {
                setCustomHours(t);
                setSelectedHours(null);
              }}
              placeholder="contoh: 2.5"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setStartModalTable(null)}>
                <ThemedText>Batal</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, submitting && styles.disabled]}
                onPress={confirmStart}
                disabled={submitting}
              >
                <ThemedText style={styles.modalConfirmText}>
                  {submitting ? "Menyimpan…" : "Mulai"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Extend session modal */}
      <Modal visible={extendSession != null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setExtendSession(null);
            setExtendHours(null);
          }}
        >
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="title" style={styles.modalTitle}>
              Tambah waktu Meja {extendSession?.table_number}
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>Pilih tambahan durasi (jam)</ThemedText>
            <View style={styles.hoursRow}>
              {[0.5, 1, 1.5, 2, 2.5, 3].map((h) => (
                <Pressable
                  key={h}
                  style={[
                    styles.hourChip,
                    extendHours === h && styles.hourChipActive,
                  ]}
                  onPress={() => setExtendHours(h)}
                >
                  <ThemedText style={styles.hourChipText}>{h}</ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setExtendSession(null);
                  setExtendHours(null);
                }}
              >
                <ThemedText>Batal</ThemedText>
              </Pressable>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  if (!extendSession) return;
                  setCheckoutSession(extendSession);
                  setPaymentMethod(null);
                  setChargeBasis("booked");
                  setCashReceived(0);
                  setCheckoutAddHoursToSession(0);
                  setExtendSession(null);
                  setExtendHours(null);
                }}
              >
                <ThemedText>Checkout</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, (submitting || !extendHours) && styles.disabled]}
                onPress={confirmExtend}
                disabled={submitting || !extendHours}
              >
                <ThemedText style={styles.modalConfirmText}>
                  {submitting ? "Menyimpan…" : "Tambah waktu"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Checkout modal */}
      <Modal visible={checkoutSession != null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setCheckoutSession(null);
            setPaymentMethod(null);
            setChargeBasis(null);
            setCashReceived(0);
            setCheckoutAddHoursToSession(0);
          }}
        >
          <Pressable
            style={[styles.modalBox, { maxHeight: "85%" }]}
            onPress={(e) => e.stopPropagation()}
          >
            {checkoutSession &&
              (() => {
                const isTimerEnded = checkoutSession.status === "timer_ended";
                const bookedHours = Number(checkoutSession.duration_hours || 0);
                const billedHours = getBilledHours(
                  checkoutSession.started_at,
                  new Date()
                );
                const baseChargeHours =
                  chargeBasis === "billed" ? billedHours : bookedHours;
                const chargeHours = baseChargeHours;
                const previewStartDate = new Date(checkoutSession.started_at);
                const previewEndDate = new Date(
                  previewStartDate.getTime() + chargeHours * 3_600_000
                );
                const totalAmount = calculateBilliardAmount(
                  checkoutSession.table_number,
                  previewStartDate,
                  previewEndDate
                );
                const isCash = paymentMethod === "Cash";
                const cashInsufficient = isCash && cashReceived < totalAmount;

                return (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.checkoutScrollContent}
                  >
                    <ThemedText type="title" style={[styles.modalTitle, styles.checkoutCenterText]}>
                      Checkout – Meja {checkoutSession.table_number}
                    </ThemedText>

                    {isTimerEnded && (
                      <>
                        <ThemedText style={[styles.sectionLabel, styles.checkoutCenterText, styles.checkoutExtraSectionLabel]}>
                          Tambah Jam Extra
                        </ThemedText>
                        <View style={styles.checkoutExtraSection}>
                          <View style={[styles.checkoutHoursRow, styles.checkoutCenterRow]}>
                            {[0, 0.5, 1, 1.5, 2].map((h) => (
                              <Pressable
                                key={h}
                                style={[
                                  styles.checkoutHourChip,
                                  checkoutAddHoursToSession === h && styles.checkoutHourChipActive,
                                ]}
                                onPress={() => setCheckoutAddHoursToSession(h)}
                              >
                                <ThemedText
                                  style={[
                                    styles.checkoutHourChipText,
                                    checkoutAddHoursToSession === h && styles.checkoutHourChipTextActive,
                                  ]}
                                >
                                  {h === 0 ? "—" : `${h}j`}
                                </ThemedText>
                              </Pressable>
                            ))}
                          </View>
                          {checkoutAddHoursToSession > 0 && (
                            <Pressable
                              style={[
                                styles.checkoutAddHoursButton,
                                addingExtendInCheckout && styles.disabled,
                              ]}
                              onPress={applyCheckoutAddHoursToSession}
                              disabled={addingExtendInCheckout}
                            >
                              <ThemedText style={styles.checkoutAddHoursButtonText}>
                                {addingExtendInCheckout
                                  ? "Menyimpan…"
                                  : `Tambah ${checkoutAddHoursToSession} jam ke sesi`}
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                        <ThemedText style={[styles.sectionLabel, styles.checkoutCenterText, { marginTop: 16 }]}>
                          Bayar
                        </ThemedText>
                      </>
                    )}

                    <ThemedText style={[styles.sectionLabel, styles.checkoutCenterText]}>Durasi</ThemedText>
                    <View style={[styles.rowBetween, styles.checkoutRowBetween]}>
                      <ThemedText style={styles.rowLabel}>Dipesan</ThemedText>
                      <ThemedText style={styles.rowValue}>
                        {bookedHours} jam
                      </ThemedText>
                    </View>
                    <View style={[styles.rowBetween, styles.checkoutRowBetween]}>
                      <ThemedText style={styles.rowLabel}>
                        Terpakai (dibulatkan)
                      </ThemedText>
                      <ThemedText style={styles.rowValue}>
                        {billedHours} jam
                      </ThemedText>
                    </View>
                    <View style={[styles.paymentRow, styles.checkoutCenterRow]}>
                      <Pressable
                        style={[
                          styles.paymentChip,
                          chargeBasis === "booked" && styles.paymentChipActive,
                        ]}
                        onPress={() => setChargeBasis("booked")}
                      >
                        <ThemedText
                          style={[
                            styles.paymentChipText,
                            chargeBasis === "booked" &&
                              styles.paymentChipTextActive,
                          ]}
                        >
                          Tagih dipesan ({bookedHours}j)
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.paymentChip,
                          chargeBasis === "billed" && styles.paymentChipActive,
                        ]}
                        onPress={() => setChargeBasis("billed")}
                      >
                        <ThemedText
                          style={[
                            styles.paymentChipText,
                            chargeBasis === "billed" &&
                              styles.paymentChipTextActive,
                          ]}
                        >
                          Tagih terpakai ({billedHours}j)
                        </ThemedText>
                      </Pressable>
                    </View>

                    <ThemedText style={[styles.amountLabel, styles.checkoutCenterText]}>Total</ThemedText>
                    <ThemedText style={[styles.amount, styles.checkoutCenterText]}>
                      {formatIDR(totalAmount)}
                    </ThemedText>

                    <ThemedText style={[styles.sectionLabel, styles.checkoutCenterText]}>
                      Metode pembayaran
                    </ThemedText>
                    <View style={[styles.paymentRow, styles.checkoutCenterRow]}>
                      {(
                        [
                          ["Cash", "Cash"],
                          ["QRIS", "QRIS"],
                          ["BNI", "QRIS BNI"],
                          ["Mandiri", "QRIS Mandiri"],
                        ] as const
                      ).map(([method, label]) => (
                        <Pressable
                          key={method}
                          style={[
                            styles.paymentChip,
                            paymentMethod === method &&
                              styles.paymentChipActive,
                          ]}
                          onPress={() => {
                            setPaymentMethod(method);
                            setCashReceived(0);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.paymentChipText,
                              paymentMethod === method &&
                                styles.paymentChipTextActive,
                            ]}
                          >
                            {label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>

                    {isCash && (
                      <View style={[styles.checkoutCenterRow, { marginTop: 12 }]}>
                        <CashPaymentCalculator
                          totalAmount={totalAmount}
                          cashReceived={cashReceived}
                          onCashReceivedChange={setCashReceived}
                          onExactAmount={() => setCashReceived(totalAmount)}
                        />
                      </View>
                    )}

                    <View style={[styles.modalActions, styles.checkoutModalActions]}>
                      <Pressable
                        style={styles.modalCancel}
                        onPress={() => {
                          setCheckoutSession(null);
                          setPaymentMethod(null);
                          setChargeBasis(null);
                          setCashReceived(0);
                          setCheckoutAddHoursToSession(0);
                        }}
                      >
                        <ThemedText>Batal</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.modalConfirm,
                          (submitting ||
                            !paymentMethod ||
                            !chargeBasis ||
                            cashInsufficient) &&
                            styles.disabled,
                        ]}
                        onPress={confirmCheckout}
                        disabled={
                          submitting ||
                          !paymentMethod ||
                          !chargeBasis ||
                          cashInsufficient
                        }
                      >
                        <ThemedText style={styles.modalConfirmText}>
                          {submitting
                            ? "Memproses…"
                            : isCash && cashReceived >= totalAmount
                              ? `Bayar (Kembalian: ${formatIDR(cashReceived - totalAmount)})`
                              : "Konfirmasi pembayaran"}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ScrollView>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>

      <PrinterConnectModal
        visible={showPrinterConnectModal}
        onClose={() => {
          setShowPrinterConnectModal(false);
          updatePrinterStatus();
        }}
        onConnected={updatePrinterStatus}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB15",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "left",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    textAlign: "left",
  },
  printerPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    maxWidth: 200,
    minHeight: 44,
    minWidth: 120,
    flexShrink: 0,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  printerPillWeb: {
    cursor: "pointer",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  } as any,
  printerPillConnected: {
    backgroundColor: "#10B981",
  },
  printerPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  summaryBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginTop: 8,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
    minWidth: 100,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryChipActive: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#14a44d20",
  },
  summaryChipAvailable: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#3b71ca20",
  },
  summaryChipEnded: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#dc4c6420",
  },
  summaryChipIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryChipContent: {
    flex: 1,
  },
  summaryChipLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 2,
  },
  summaryChipValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    minHeight: 150,
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    justifyContent: "center",
  },
  cardStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
  },
  cardTimer: {
    fontSize: 24,
    marginTop: 8,
    fontWeight: "600",
    color: "#000",
  },
  cardInfo: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
    color: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: "#000",
  },
  checkoutScrollContent: {
    alignItems: "center",
    paddingBottom: 24,
  },
  checkoutCenterText: {
    textAlign: "center",
    alignSelf: "stretch",
  },
  checkoutCenterRow: {
    justifyContent: "center",
    alignSelf: "stretch",
  },
  checkoutCenterButton: {
    alignSelf: "center",
  },
  checkoutRowBetween: {
    alignSelf: "stretch",
  },
  checkoutModalActions: {
    justifyContent: "center",
    alignSelf: "stretch",
  },
  checkoutExtraSectionLabel: {
    marginBottom: 10,
  },
  checkoutExtraSection: {
    alignSelf: "stretch",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    gap: 14,
  },
  checkoutHoursRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 10,
  },
  checkoutHourChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutHourChipActive: {
    backgroundColor: "#2f95dc",
    borderColor: "#2f95dc",
  },
  checkoutHourChipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  checkoutHourChipTextActive: {
    color: "#fff",
  },
  checkoutAddHoursButton: {
    alignSelf: "stretch",
    backgroundColor: "#2f95dc",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutAddHoursButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalSubtitle: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 16,
    marginBottom: 8,
    color: "#000",
  },
  hoursRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hourChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  hourChipActive: {
    backgroundColor: "#2f95dc",
  },
  hourChipText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#000",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalConfirm: {
    backgroundColor: "#2f95dc",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  sectionLabel: {
    marginTop: 16,
    fontSize: 12,
    opacity: 0.8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#000",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rowLabel: {
    fontSize: 13,
    opacity: 0.9,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  amount: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
    color: "#000",
  },
  amountLabel: {
    marginTop: 16,
    fontSize: 12,
    opacity: 0.8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#000",
  },
  paymentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  paymentChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  paymentChipActive: {
    backgroundColor: "#2f95dc",
  },
  paymentChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  paymentChipTextActive: {
    color: "#fff",
  },
});

