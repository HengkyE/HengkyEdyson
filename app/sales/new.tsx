import { CashPaymentCalculator } from "@/edysonpos/components/cash-payment-calculator";
import { PaymentMethodSelector, type PaymentMethod } from "@/components/payment-method-selector";
import { PrinterConnectModal } from "@/components/printer-connect-modal";
import { QuantityModal } from "@/components/quantity-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createJualanKontan, getBarangByBarcode, updateBarangStock } from "@/edysonpos/services/database";
import { subscribeScannedBarcode } from "@/edysonpos/services/scanned-barcode-store";
import { shareReceiptAsPDF } from "@/edysonpos/services/receipt-generator";
import { sendCashSaleToTelegramWithPDF } from "@/edysonpos/services/telegram";
import { thermalPrinter } from "@/edysonpos/services/thermal-printer";
import type { Barang, CartItem } from "@/edysonpos/types/database";
import { formatIDR } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function NewSaleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, profile } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLargeScreen = screenWidth >= 768;

  const [cart, setCart] = useState<CartItem[]>([]);
  // Keep a ref in sync with cart to avoid any stale closures
  const cartRef = useRef<CartItem[]>([]);
  const cashierName = profile?.fullName || user?.email?.split("@")[0] || "User";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Track if we've processed a scanned barcode to avoid duplicate processing
  const processedBarcodeRef = useRef<string | null>(null);
  // Ref for barcode input to maintain focus after scanning
  const barcodeInputRef = useRef<TextInput>(null);
  const barcodeInputFocusedRef = useRef(true);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Redirect Enter (from scanner) to barcode input when focus is elsewhere - prevents back/button presses
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (barcodeInputFocusedRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      barcodeInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Debug: Log cart changes
  useEffect(() => {
    cartRef.current = cart;
    console.log("Cart updated:", cart.length, "items");
    cart.forEach((item, index) => {
      console.log(
        `  [${index}] ${item.barang.barangNama} x${item.quantity} = ${formatIDR(
          item.price * item.quantity
        )}`
      );
    });
  }, [cart]);

  const addToCart = (barang: Barang, quantity: number = 1) => {
    console.log("=== addToCart called ===");
    console.log("Adding to cart:", barang.barangNama, "Quantity:", quantity);
    console.log("Barang ID:", barang.id);
    console.log("Barang price:", barang.barangHarga);

    const currentCart = cartRef.current || [];
    console.log("Current cart length before add:", currentCart.length);
    console.log(
      "Current cart items:",
      currentCart.map((item) => item.barang.id)
    );

    const normalizedBarcode = barang.id.toUpperCase().trim();
    console.log("Normalized barcode:", normalizedBarcode);

    const existingItemIndex = currentCart.findIndex(
      (item) => item.barang.id.toUpperCase().trim() === normalizedBarcode
    );
    console.log("Existing item index:", existingItemIndex);

    let updatedCart: CartItem[];

    if (existingItemIndex >= 0) {
      // Item already in cart, increment quantity
      console.log("Item exists in cart, incrementing quantity");
      updatedCart = [...currentCart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: updatedCart[existingItemIndex].quantity + quantity,
      };
      console.log("Updated cart (existing item):", updatedCart.length, "items");
    } else {
      // New item, add to cart at the beginning (first row) so user can see it immediately
      console.log("New item, adding to cart at first row");
      const newItem: CartItem = {
        barang,
        quantity,
        price: barang.barangHarga,
      };
      console.log("New item object:", newItem);
      updatedCart = [newItem, ...currentCart];
      console.log("Updated cart (new item):", updatedCart.length, "items");
      console.log(
        "Updated cart items:",
        updatedCart.map((item) => item.barang.id)
      );
    }

    console.log("Setting cart ref and state...");
    cartRef.current = updatedCart;
    setCart(updatedCart);
    console.log("Cart state set, new length:", updatedCart.length);
  };

  const removeFromCart = (barangId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.barang.id !== barangId));
  };

  const updateQuantity = (barangId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(barangId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.barang.id === barangId ? { ...item, quantity } : item))
    );
  };

  const fetchBarangWithTimeout = (barcode: string, timeoutMs: number) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    });
    return Promise.race([getBarangByBarcode(barcode), timeoutPromise]);
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode || !barcode.trim()) {
      return;
    }

    const trimmedBarcode = barcode.trim().toUpperCase();
    console.log("Scanning barcode:", trimmedBarcode);

    try {
      setLoading(true);

      // 20s timeout; on timeout retry once (helps with slow/cold connections)
      let barang = null;
      try {
        barang = await fetchBarangWithTimeout(trimmedBarcode, 20000);
      } catch (firstError: any) {
        if (firstError?.message === "Request timeout") {
          console.log("First attempt timed out, retrying...");
          barang = await fetchBarangWithTimeout(trimmedBarcode, 20000);
        } else {
          throw firstError;
        }
      }
      
      console.log("Barang result:", barang);
      console.log("Barang stock:", barang?.stockBarang);

      if (barang) {
        // Allow adding to cart regardless of stock (stock can go negative for now)
        addToCart(barang, 1);
        setBarcodeInput("");
        console.log("Item added to cart:", barang.barangNama);
      } else {
        console.log("Barang is null or undefined - barcode does not exist");
        setBarcodeInput(""); // Clear input
        const msg = `Kode yang dimasukkan "${trimmedBarcode}" tidak ada dalam sistem.`;
        if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
          window.alert("Kode Tidak Ditemukan\n\n" + msg);
        } else {
          Alert.alert("Kode Tidak Ditemukan", msg);
        }
      }
    } catch (error: any) {
      console.error("Error scanning barcode:", error);
      setBarcodeInput(""); // Clear input on error

      let errorMessage = "Kode yang dimasukkan tidak ada dalam sistem.";
      if (error?.message === "Request timeout") {
        errorMessage = "Waktu permintaan habis. Silakan coba lagi.";
      } else if (error?.code === "PGRST116") {
        errorMessage = `Kode yang dimasukkan "${trimmedBarcode}" tidak ada dalam sistem.`;
      } else if (error?.code === "PGRST301" || error?.status === 406) {
        errorMessage = "Akses ditolak. Silakan periksa autentikasi Anda.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert("Kode Tidak Ditemukan\n\n" + errorMessage);
      } else {
        Alert.alert("Kode Tidak Ditemukan", errorMessage);
      }
    } finally {
      setLoading(false);
      // Refocus the barcode input for seamless scanning
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  };

  // Keep handleBarcodeScan in a ref so the subscription can call it without stale closure
  const handleBarcodeScanRef = useRef(handleBarcodeScan);
  useEffect(() => {
    handleBarcodeScanRef.current = handleBarcodeScan;
  }, [handleBarcodeScan]);

  // Inline camera scanner handler - same flow as grosir/ProductForm: close modal immediately, process async
  const handleCameraBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scannerScanned) return;
    setScannerScanned(true);
    const code = data.trim().toUpperCase();
    setShowScannerModal(false);
    setScannerScanned(false);
    if (code) void handleBarcodeScan(code);
  };

  // Process scanned barcode from scanner screen (event-based, fallback).
  // Scanner emits barcode and router.back() so we stay on the SAME screen instance (no double page).
  useEffect(() => {
    const unsubscribe = subscribeScannedBarcode(({ barcode, returnTo }) => {
      if (returnTo !== "kontan") return;
      const cleaned = barcode?.trim()?.toUpperCase();
      if (!cleaned) return;
      if (cleaned === processedBarcodeRef.current) return;

      console.log("Processing scanned barcode via event (Kontan):", cleaned);
      processedBarcodeRef.current = cleaned;
      void handleBarcodeScanRef.current(cleaned);
    });
    return unsubscribe;
  }, []);

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to the cart first.");
      return;
    }
    // If printer not connected, offer to connect before checkout (cash receipt)
    if (!thermalPrinter.isConnected()) {
      // On web, `Alert.alert` may not reliably show a native dialog.
      // Use a simple confirm flow so the checkout button always "works".
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
        const proceed = window.confirm(
          "Printer not connected.\n\nOK: Continue without printing\nCancel: Connect printer"
        );
        if (proceed) {
          setShowPaymentModal(true);
          setCashReceived(0);
        } else {
          setShowPrinterModal(true);
        }
      } else {
        Alert.alert(
          "Printer not connected",
          "Connect printer to print the receipt?",
          [
            {
              text: "Continue without printing",
              onPress: () => {
                setShowPaymentModal(true);
                setCashReceived(0);
              },
            },
            { text: "Connect printer", onPress: () => setShowPrinterModal(true) },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
      return;
    }
    setShowPaymentModal(true);
    setCashReceived(0);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to the cart first.");
      return;
    }

    // Validate cash payment
    if (paymentMethod === "Cash" && cashReceived < total) {
      Alert.alert("Insufficient Payment", `Please enter at least ${formatIDR(total)} in cash.`);
      return;
    }

    try {
      setLoading(true);
      console.log("Starting sale completion...");
      console.log("Creating jualanKontan record...");
      const sale = await createJualanKontan(total, cashierName, paymentMethod, cart, profile?.id);
      console.log("Sale created successfully:", sale);

      // Update stock for each item (allow negative for now until stock is properly managed)
      console.log("Updating stock for items...");
      for (const item of cart) {
        const currentStock = item.barang.stockBarang ?? 0;
        const newStock = currentStock - item.quantity;
        console.log(
          `Updating stock for ${item.barang.barangNama}: ${currentStock} -> ${newStock}`
        );
        await updateBarangStock(item.barang.id, newStock);
        console.log(`Stock updated for ${item.barang.barangNama}`);
      }
      console.log("All stock updates completed");

      // Prepare receipt data for background tasks
      const receiptData = {
        items: cart,
        total,
        paymentMethod,
        cashierName,
        date: new Date(),
        saleId: sale.id,
        cashReceived: paymentMethod === "Cash" ? cashReceived : undefined,
        change: paymentMethod === "Cash" && cashReceived > total ? cashReceived - total : undefined,
      };

      const change = paymentMethod === "Cash" && cashReceived > total ? cashReceived - total : 0;
      const successMessage =
        paymentMethod === "Cash" && change > 0
          ? `Sale completed! Change: ${formatIDR(change)}`
          : "Sale completed successfully!";

      // Close modal and show success immediately (no waiting for PDF/Telegram/print)
      setLoading(false);
      setShowPaymentModal(false);
      setCart([]);
      setCashReceived(0);
      setBarcodeInput("");
      processedBarcodeRef.current = null;

      // Keep user on this sale screen for next transaction
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 150);

      Alert.alert("Success", successMessage);

      // Run PDF, Telegram, and thermal print in background (fire-and-forget)
      const shouldPrintReceipt = printReceipt;
      void (async () => {
        try {
          const pdfUri = await shareReceiptAsPDF(
            receiptData,
            "cash",
            "A4",
            true,
            "TOKO EDYSON"
          );
          await sendCashSaleToTelegramWithPDF(pdfUri, receiptData);
        } catch (e) {
          console.error("PDF/Telegram:", e);
        }
        try {
          if (shouldPrintReceipt && thermalPrinter.isConnected()) {
            await thermalPrinter.printCashReceipt(receiptData);
          } else if (shouldPrintReceipt) {
            await thermalPrinter.testConnection();
            if (thermalPrinter.isConnected()) {
              await thermalPrinter.printCashReceipt(receiptData);
            }
          }
        } catch (e) {
          console.error("Print receipt:", e);
        }
      })();
    } catch (error) {
      console.error("Error completing sale:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setLoading(false);
      Alert.alert(
        "Error",
        `Failed to complete sale: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );
    }
  };

  const handleExactAmount = () => {
    setCashReceived(total);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Belanja Kontan - Top */}
      <View style={[styles.belanjaKontanBanner, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.belanjaKontanTitle, { color: colors.text }]}>
          Belanja Kontan
        </ThemedText>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Top Header Section */}
      <View style={[styles.topHeader, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.topHeaderLeft}>
          <Card style={styles.headerCard}>
            <ThemedText style={[styles.headerCardTitle, { color: colors.text }]}>
              Toko Edyson - Kontan
            </ThemedText>
            <View style={styles.userInfo}>
              <Ionicons name="person-outline" size={16} color={colors.icon} />
              <ThemedText style={[styles.userEmail, { color: colors.icon }]}>
                {user?.email || `${cashierName}@toko.com`}
              </ThemedText>
            </View>
          </Card>
          <Card style={styles.printerCard}>
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
                activeOpacity={0.7}
              >
                <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.printerConnectButtonText}>
                  {thermalPrinter.isConnected() ? "Change" : "Connect"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
        <View style={styles.topHeaderRight}>
          <Card style={styles.headerCard}>
            <View style={styles.totalInfo}>
              <Ionicons name="cart-outline" size={20} color={colors.primary} />
              <ThemedText style={[styles.totalLabel, { color: colors.text }]}>
                Total Belanja
              </ThemedText>
            </View>
            <ThemedText style={[styles.totalAmount, { color: colors.primary }]}>
              {formatIDR(total)}
            </ThemedText>
          </Card>
          <TouchableOpacity
            style={[styles.completeButtonTop, { backgroundColor: colors.primary }]}
            onPress={handleOpenPaymentModal}
            disabled={cart.length === 0 || loading}
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <ThemedText style={styles.completeButtonText}>Selesai ({cart.length})</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.icon + "20" }]} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Barcode Input Section */}
        <View style={styles.barcodeSection}>
          <TextInput
            ref={barcodeInputRef}
            style={[
              styles.barcodeInput,
              {
                backgroundColor: colors.cardBackground,
                color: colors.text,
                borderColor: colors.primary,
              },
            ]}
            value={barcodeInput}
            onChangeText={(text) => setBarcodeInput(text)}
            placeholder="Masukkan barcode"
            placeholderTextColor={colors.icon}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            onFocus={() => (barcodeInputFocusedRef.current = true)}
            onBlur={() => (barcodeInputFocusedRef.current = false)}
            onEndEditing={(e) => {
              const normalized = (e.nativeEvent.text || "").trim().toUpperCase();
              if (normalized !== barcodeInput) setBarcodeInput(normalized);
            }}
            onSubmitEditing={() => {
              const normalized = barcodeInput.trim().toUpperCase();
              if (normalized) handleBarcodeScan(normalized);
            }}
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: colors.primary,
                opacity: barcodeInput.trim() && !loading ? 1 : 0.5,
              },
            ]}
            onPress={() => {
              const normalized = barcodeInput.trim().toUpperCase();
              if (normalized && !loading) {
                handleBarcodeScan(normalized);
              }
            }}
            disabled={!barcodeInput.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="add" size={20} color="#FFFFFF" />
            )}
            <ThemedText style={styles.addButtonText}>Barang</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setShowScannerModal(true);
              setScannerScanned(false);
            }}
          >
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <ThemedText style={[styles.scanButtonText, { color: "#FFFFFF" }]}>Scan</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Cart Items */}
        {cart.length === 0 ? (
          <View style={styles.emptyCartContainer}>
            <ThemedText style={[styles.emptyCart, { color: colors.icon }]}>
              Cart is empty. Scan or add items to get started.
            </ThemedText>
            <ThemedText
              style={[styles.emptyCart, { color: colors.icon, marginTop: 10, fontSize: 12 }]}
            >
              Cart state: {cart.length} items | Ref: {cartRef.current.length} items
            </ThemedText>
          </View>
        ) : (
          <View style={styles.cartSection}>
            {cart.map((item) => (
              <View key={item.barang.id} style={styles.cartItem}>
                <View style={styles.cartItemLeft}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.cartItemName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.barang.barangNama}
                  </ThemedText>
                  <ThemedText style={[styles.cartItemDetails, { color: colors.icon }]}>
                    {formatIDR(item.price)} / {item.barang.barangUnit}
                  </ThemedText>
                </View>
                <View style={styles.cartItemRight}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.cartItemTotal, { color: colors.text }]}
                  >
                    {formatIDR(item.price * item.quantity)}
                  </ThemedText>
                  <View style={styles.cartItemActions}>
                    <TouchableOpacity
                      style={styles.quantityControls}
                      onPress={() => {
                        setSelectedItemId(item.barang.id);
                        setShowQuantityModal(true);
                      }}
                    >
                      <ThemedText style={[styles.quantityText, { color: colors.text }]}>
                        Jml: {item.quantity}
                      </ThemedText>
                      <Ionicons name="chevron-down" size={14} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeFromCart(item.barang.id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      {showPaymentModal && (
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              padding: isLargeScreen ? 24 : 0,
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            style={{
              width: "100%",
              flex: 1,
              justifyContent: isLargeScreen ? "center" : "flex-end",
              alignItems: isLargeScreen ? "center" : undefined,
            }}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.cardBackground,
                  ...(isLargeScreen
                    ? {
                        width: Math.min(560, screenWidth - 48),
                        maxHeight: Math.min(screenHeight * 0.85, 720),
                        borderRadius: 16,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        paddingBottom: 8,
                      }
                    : null),
                },
              ]}
            >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Checkout
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Card style={styles.modalCard}>
                <View style={styles.totalRow}>
                  <ThemedText type="subtitle" style={{ color: colors.text }}>
                    Total Belanja
                  </ThemedText>
                  <ThemedText type="title" style={{ color: colors.primary }}>
                    {formatIDR(total)}
                  </ThemedText>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
                  onSelectMethod={setPaymentMethod}
                />
              </Card>

              {paymentMethod === "Cash" && (
                <Card style={styles.modalCard}>
                  <CashPaymentCalculator
                    totalAmount={total}
                    cashReceived={cashReceived}
                    onCashReceivedChange={setCashReceived}
                    onExactAmount={handleExactAmount}
                  />
                </Card>
              )}

              {paymentMethod !== "Cash" && (
                <Card style={styles.modalCard}>
                  <ThemedText style={[styles.infoText, { color: colors.icon }]}>
                    Payment will be processed via {paymentMethod}
                  </ThemedText>
                </Card>
              )}

              <Card style={styles.modalCard}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setPrintReceipt(!printReceipt)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={printReceipt ? "checkbox" : "checkbox-outline"}
                    size={22}
                    color={printReceipt ? colors.primary : colors.icon}
                  />
                  <ThemedText style={[styles.checkboxLabel, { color: colors.text }]}>
                    Print thermal receipt
                  </ThemedText>
                </TouchableOpacity>
              </Card>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title="Cancel"
                onPress={() => setShowPaymentModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title={
                  paymentMethod === "Cash" && cashReceived >= total
                    ? "Complete Sale"
                    : `Pay with ${paymentMethod}`
                }
                onPress={handleCompleteSale}
                loading={loading}
                disabled={paymentMethod === "Cash" && cashReceived < total}
                style={styles.modalButton}
                size="large"
              />
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <PrinterConnectModal
        visible={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
      />

      {/* Quantity Modal */}
      <QuantityModal
        visible={showQuantityModal}
        currentQuantity={
          selectedItemId ? cart.find((item) => item.barang.id === selectedItemId)?.quantity || 1 : 1
        }
        productName={
          selectedItemId
            ? cart.find((item) => item.barang.id === selectedItemId)?.barang.barangNama
            : undefined
        }
        onClose={() => {
          setShowQuantityModal(false);
          setSelectedItemId(null);
        }}
        onConfirm={(quantity) => {
          if (selectedItemId) {
            updateQuantity(selectedItemId, quantity);
          }
        }}
      />

      {/* Inline Camera Barcode Scanner Modal - same flow as grosir/ProductForm for faster scanning */}
      <Modal
        visible={showScannerModal}
        animationType="slide"
        onRequestClose={() => setShowScannerModal(false)}
      >
        <ThemedView style={styles.scannerModalContainer}>
          <View style={styles.scannerModalHeader}>
            <ThemedText type="title" style={styles.scannerModalTitle}>
              Scan Barcode
            </ThemedText>
            <TouchableOpacity
              style={[styles.scannerModalCloseBtn, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowScannerModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {!cameraPermission && (
            <View style={styles.scannerModalContent}>
              <ThemedText style={{ color: colors.text }}>Requesting camera permission...</ThemedText>
            </View>
          )}
          {cameraPermission && !cameraPermission.granted && (
            <View style={styles.scannerModalContent}>
              <ThemedText style={{ color: colors.text }}>No access to camera</ThemedText>
              <TouchableOpacity
                style={[styles.scannerModalGrantBtn, { backgroundColor: colors.primary }]}
                onPress={requestCameraPermission}
              >
                <ThemedText style={styles.scannerModalGrantBtnText}>Grant Permission</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          {cameraPermission?.granted && (
            <View style={styles.scannerModalContent}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc", "code128", "code39", "code93"],
                }}
                onBarcodeScanned={scannerScanned ? undefined : handleCameraBarCodeScanned}
              />
              <View style={styles.scannerModalOverlay}>
                <View style={[styles.scannerModalFrame, { borderColor: colors.primary }]} />
                <ThemedText style={[styles.scannerModalInstruction, { color: "#FFFFFF" }]}>
                  Position the barcode within the frame
                </ThemedText>
                {scannerScanned && (
                  <TouchableOpacity
                    style={[styles.scannerModalRescanBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setScannerScanned(false)}
                  >
                    <ThemedText style={styles.scannerModalGrantBtnText}>
                      Tap to Scan Again
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  belanjaKontanBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  belanjaKontanTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  backButtonPlaceholder: {
    width: 20,
  },
  topHeader: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  topHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  topHeaderRight: {
    flex: 1,
    gap: 8,
  },
  headerCard: {
    padding: 12,
    marginBottom: 0,
  },
  headerCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userEmail: {
    fontSize: 12,
  },
  totalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  completeButtonTop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  printerCard: {
    marginVertical: 0,
    marginHorizontal: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  printerConnectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  printerConnectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  barcodeSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  barcodeInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scannerModalContainer: {
    flex: 1,
  },
  scannerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 60,
  },
  scannerModalTitle: {
    fontSize: 20,
  },
  scannerModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerModalFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: 12,
  },
  scannerModalInstruction: {
    marginTop: 20,
    fontSize: 16,
    textAlign: "center",
  },
  scannerModalRescanBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  scannerModalGrantBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  scannerModalGrantBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyCartContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyCart: {
    textAlign: "center",
    fontSize: 14,
  },
  cartSection: {
    gap: 8,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cartItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 14,
    marginBottom: 4,
  },
  cartItemDetails: {
    fontSize: 12,
  },
  cartItemRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: "600",
  },
  cartItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  quantityText: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 40,
    textAlign: "center",
  },
  deleteButton: {
    padding: 4,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "90%",
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
  },
  modalCard: {
    margin: 16,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 14,
    textAlign: "center",
    padding: 12,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  modalButton: {
    flex: 1,
  },
});
