import { CalculatorModal } from "@/components/calculator-modal";
import { PrinterConnectModal } from "@/components/printer-connect-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  createGrosirDraft,
  createJualanGrosir,
  deleteGrosirDraft,
  getBarangByBarcode,
  getBarangById,
  getGrosirDraftById,
  getGrosirDraftItems,
  updateBarangStock,
  updateGrosirDraft,
} from "@/services/database";
import { subscribeScannedBarcode } from "@/services/scanned-barcode-store";
import { sendWholesaleSaleToTelegram } from "@/services/telegram";
import { thermalPrinter } from "@/services/thermal-printer";
import type { Barang, CartItem } from "@/types/database";
import { formatIDR } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

export default function WholesaleSaleScreen() {
  const router = useRouter();
  const { draft: draftId, scannedBarcode } = useLocalSearchParams<{ draft?: string; scannedBarcode?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoint - use stacked layout on mobile (< 768px)
  const isMobile = width < 768;
  // Use centered modals on tablet/desktop (>= 600px) for easier viewing
  const useCenteredModals = width >= 600;

  const [cart, setCart] = useState<CartItem[]>([]);
  // Keep a ref in sync with cart to avoid any stale closures
  const cartRef = useRef<CartItem[]>([]);
  // Ref for barcode input to maintain focus after scanning
  const barcodeInputRef = useRef<TextInput>(null);
  // Ref to track which barcode was last processed (to avoid duplicate processing)
  const processedBarcodeRef = useRef<string | null>(null);
  // Keep latest handleBarcodeScan to avoid stale closures (especially for scanner events)
  const handleBarcodeScanRef = useRef<(barcode: string) => Promise<void>>(async () => {});
  const cashierName = profile?.fullName || user?.email?.split("@")[0] || "User";
  const [customerName, setCustomerName] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveDraftLoading, setSaveDraftLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [setorGrosir, setSetorGrosir] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "QRIS" | "BNI" | "BRI" | "Mandiri">(
    "Cash"
  );
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printSuratJalan, setPrintSuratJalan] = useState(true);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showItemMenuModal, setShowItemMenuModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [customerNameError, setCustomerNameError] = useState(false);
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemPrice, setManualItemPrice] = useState("");
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
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
  const sisaBonGrosir = total - setorGrosir;

  // Keep cartRef in sync with cart state
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Load saved draft when ?draft=id is present
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const draft = await getGrosirDraftById(draftId);
        if (cancelled || !draft) return;
        const items = await getGrosirDraftItems(draft.id);
        setCustomerName(draft.namaPelanggan || "");
        setSetorGrosir(draft.setorAwal || 0);
        const cartItems: CartItem[] = [];
        for (const row of items) {
          const barang = await getBarangById(row.barangId);
          if (barang) {
            cartItems.push({
              barang,
              quantity: row.quantity,
              price: row.unitPrice,
            });
          } else {
            const minimalBarang: Barang = {
              id: row.barangId,
              createdAt: "",
              createdBy: "",
              barangNama: row.barangNama,
              barangType: "",
              barangUnit: row.barangUnit || "Pcs",
              barangHarga: row.unitPrice,
              barangModal: 0,
              barangGrosir: row.unitPrice,
              barangBon: 0,
              barangNote: null,
              stockBarang: 0,
              stockTokoMini: 0,
            };
            cartItems.push({
              barang: minimalBarang,
              quantity: row.quantity,
              price: row.unitPrice,
            });
          }
        }
        if (!cancelled) {
          setCart(cartItems);
          cartRef.current = cartItems;
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Error loading draft:", e);
          Alert.alert("Error", "Failed to load saved transaction.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  // Process scanned barcode from scanner screen
  useEffect(() => {
    if (scannedBarcode && scannedBarcode !== processedBarcodeRef.current) {
      console.log("Processing scanned barcode from scanner (Grosir):", scannedBarcode);
      processedBarcodeRef.current = scannedBarcode;
      // Use the existing handleBarcodeScan function to add item to cart
      void handleBarcodeScanRef.current(scannedBarcode);
      // Clear the URL param to prevent re-processing on re-renders
      router.setParams({ scannedBarcode: undefined });
    }
  }, [scannedBarcode]);

  // Preferred flow for camera scanning on Grosir:
  // `/sales/scan` emits a barcode event and calls `router.back()` so we return to the
  // SAME screen instance (no remount / no cart reset).
  useEffect(() => {
    const unsubscribe = subscribeScannedBarcode(({ barcode, returnTo }) => {
      if (returnTo !== "grosir") return;
      const cleaned = barcode?.trim()?.toUpperCase();
      if (!cleaned) return;
      if (cleaned === processedBarcodeRef.current) return;

      console.log("Processing scanned barcode via event (Grosir):", cleaned);
      processedBarcodeRef.current = cleaned;
      void handleBarcodeScanRef.current(cleaned);
    });
    return unsubscribe;
  }, []);

  const addToCart = (barang: Barang, quantity: number = 1) => {
    console.log("=== addToCart called (Wholesale) ===");
    console.log("Adding to cart:", barang.barangNama, "Quantity:", quantity);
    console.log("Barang ID:", barang.id);
    console.log("Barang grosir price:", barang.barangGrosir);

    const currentCart = cartRef.current || [];
    console.log("Current cart length before add:", currentCart.length);

    const existingItemIndex = currentCart.findIndex((item) => item.barang.id === barang.id);
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
    } else {
      // New item, add to cart at the beginning (first row) so user can see it immediately
      console.log("New item, adding to cart");
      const newItem: CartItem = {
        barang,
        quantity,
        price: barang.barangGrosir, // Use wholesale price for grosir sales
      };
      updatedCart = [newItem, ...currentCart];
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

  const updateItemPrice = (barangId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart((prevCart) =>
      prevCart.map((item) => (item.barang.id === barangId ? { ...item, price: newPrice } : item))
    );
  };

  const addManualItemToCart = () => {
    const itemName = manualItemName.trim() || "Barang Tambahan";
    const price = parseFloat(manualItemPrice.replace(/[^0-9]/g, "")) || 0;

    if (price <= 0) {
      Alert.alert("Error", "Please enter a valid price.");
      return;
    }

    // Create a minimal Barang object for manual items
    const manualBarang: Barang = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      createdBy: user?.id || "",
      barangNama: itemName,
      barangType: "Manual",
      barangUnit: "Pcs",
      barangHarga: price,
      barangModal: 0,
      barangGrosir: price,
      barangBon: 0,
      barangNote: null,
      stockBarang: 0,
      stockTokoMini: 0,
    };

    // Add to cart
    const newItem: CartItem = {
      barang: manualBarang,
      quantity: 1,
      price: price,
    };

    setCart((prevCart) => [newItem, ...prevCart]);
    cartRef.current = [newItem, ...cartRef.current];

    // Reset form and close modal
    setManualItemName("");
    setManualItemPrice("");
    setShowManualItemModal(false);
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
    console.log("Scanning barcode (Wholesale):", trimmedBarcode);

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

  // Keep ref updated so scanner events always call the latest implementation
  handleBarcodeScanRef.current = handleBarcodeScan;

  // Inline camera scanner handler - same flow as ProductForm: close modal immediately, process async
  const handleCameraBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scannerScanned) return;
    setScannerScanned(true);
    const code = data.trim().toUpperCase();
    setShowScannerModal(false);
    setScannerScanned(false);
    if (code) void handleBarcodeScan(code);
  };

  const handleSaveTransaction = async () => {
    if (cart.length === 0) {
      Alert.alert("Keranjang Kosong", "Tambahkan barang ke keranjang sebelum menyimpan.");
      return;
    }
    try {
      setSaveDraftLoading(true);
      if (draftId) {
        await updateGrosirDraft(
          draftId,
          customerName.trim() || "Pelanggan",
          total,
          setorGrosir,
          cart
        );
        Alert.alert(
          "Saved",
          "Transaksi berhasil disimpan. Anda dapat melanjutkan mengedit atau melakukan penjualan ketika siap.",
          [{ text: "OK" }]
        );
      } else {
        await createGrosirDraft(
          customerName.trim() || "Pelanggan",
          total,
          0,
          cart,
          profile?.id
        );
        Alert.alert(
          "Saved",
          "Transaksi berhasil disimpan. Anda dapat melanjutkan mengedit atau melakukan penjualan ketika siap.",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      console.error("Gagal menyimpan draft:", e);
      Alert.alert("Error", "Gagal menyimpan transaksi. Silakan coba lagi.");
    } finally {
      setSaveDraftLoading(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) {
      Alert.alert("Keranjang Kosong", "Tambahkan barang ke keranjang sebelum melakukan penjualan.");
      return;
    }
    setCustomerNameError(false);
    setShowPaymentModal(true);
    setSetorGrosir(0);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      Alert.alert("Keranjang Kosong", "Tambahkan barang ke keranjang sebelum melakukan penjualan.");
      return;
    }

    if (!customerName.trim()) {
      setCustomerNameError(true);
      return;
    }
    setCustomerNameError(false);

    try {
      setLoading(true);

      // Create wholesale sale (invoice number is handled inside createJualanGrosir)
      // Payment history is automatically added if setorGrosir > 0
      const sale = await createJualanGrosir(
        customerName.trim(),
        total,
        setorGrosir,
        sisaBonGrosir,
        cashierName,
        paymentMethod,
        cart,
        profile?.id
      );

      // Update stock for each item (allow negative for now until stock is properly managed)
      for (const item of cart) {
        const currentStock = item.barang.stockBarang ?? 0;
        const newStock = currentStock - item.quantity;
        await updateBarangStock(item.barang.id, newStock);
      }

      // Send to Telegram (matching old system - no print dialog)
      // The sendWholesaleSaleToTelegram function generates the PDF internally
      try {
        await sendWholesaleSaleToTelegram(
          {
            items: cart,
            total,
            paymentMethod,
            cashierName,
            date: new Date(),
            saleId: sale.id,
            customerName: customerName.trim(),
            invoiceNo: sale.invoiceNo,
            setorGrosir,
            sisaBonGrosir,
          },
          "A4",
          sale.invoiceNo
        );
      } catch (telegramError) {
        console.error("Error sending to Telegram:", telegramError);
        Alert.alert(
          "Telegram PDF failed",
          "Transaksi berhasil disimpan, tetapi gagal mengirim PDF ke Telegram. Silakan coba lagi.",
          [
            {
              text: "Retry",
              onPress: async () => {
                try {
                  await sendWholesaleSaleToTelegram(
                    {
                      items: cart,
                      total,
                      paymentMethod,
                      cashierName,
                      date: new Date(),
                      saleId: sale.id,
                      customerName: customerName.trim(),
                      invoiceNo: sale.invoiceNo,
                      setorGrosir,
                      sisaBonGrosir,
                    },
                    "A4",
                    sale.invoiceNo
                  );
                } catch (e) {
                  console.error("Retry Telegram send failed:", e);
                }
              },
            },
            { text: "OK" },
          ]
        );
      }

      // Print receipt to thermal printer (only if already connected — connecting requires a user gesture on web)
      const receiptData = {
        items: cart,
        total,
        paymentMethod,
        cashierName,
        date: new Date(),
        saleId: sale.id,
        customerName: customerName.trim(),
        invoiceNo: sale.invoiceNo,
        setorGrosir,
        sisaBonGrosir,
      };
      if (thermalPrinter.isConnected()) {
        try {
          if (printReceipt) {
            await thermalPrinter.printWholesaleReceipt(receiptData);
            console.log("Wholesale receipt printed successfully");
          }
          if (printSuratJalan) {
            try {
              await thermalPrinter.printGrosirSuratJalan(receiptData);
              console.log("Surat Jalan printed successfully");
            } catch (suratJalanError) {
              console.error("Error printing Surat Jalan:", suratJalanError);
            }
          }
        } catch (printError) {
          console.error("Error printing wholesale receipt:", printError);
        }
      } else {
        console.warn("Printer not connected. Connect printer in Settings before completing a sale to print receipts.");
      }

      // If this sale was continued from a saved draft, delete the draft so it no longer appears in Saved transactions
      if (draftId) {
        try {
          await deleteGrosirDraft(draftId);
        } catch (deleteErr) {
          console.error("Error deleting draft after checkout:", deleteErr);
        }
      }

      // Close modal and clear cart/form immediately so screen is ready for next transaction
      setShowPaymentModal(false);
      setCart([]);
      cartRef.current = [];
      setCustomerName("");
      setSetorGrosir(0);

      const printerNote = thermalPrinter.isConnected() ? "" : "\n\n(Receipt was not printed — connect printer in Settings before the next sale to print receipts.)";
      Alert.alert(
        "Success",
        `Wholesale sale completed!\nInvoice #${sale.invoiceNo}\nRemaining: ${formatIDR(
          sisaBonGrosir
        )}${printerNote}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error completing sale:", error);
      Alert.alert("Error", "Gagal menyelesaikan penjualan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header with back button */}
      <View style={[styles.headerBar, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={[styles.headerTitle, { color: colors.text }]}>
          {t("sales.penjualanGrosir")}
        </ThemedText>
        <View style={styles.headerPlaceholder} />
      </View>

      {isMobile ? (
        /* Mobile Layout: Single column, scrollable */
        <ScrollView 
          style={styles.mobileScrollView} 
          contentContainerStyle={styles.mobileScrollContent}
          keyboardShouldPersistTaps="handled"
        >

          {/* Scan Barcode */}
          <Card style={[styles.barcodeCard, { padding: 4, marginVertical: 0 }]}>
            <View style={styles.barcodeInputContainer}>
              <TextInput
                ref={barcodeInputRef}
                style={[
                  styles.barcodeInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={barcodeInput}
                onChangeText={(text) => setBarcodeInput(text)}
                placeholder={t("sales.enterBarcodeOrScan")}
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
                style={[styles.scanButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowScannerModal(true);
                  setScannerScanned(false);
                }}
              >
                <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addManualButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowManualItemModal(true)}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </Card>

          {/* Cart Section */}
          <View style={styles.mobileCartSection}>
            {cart.length === 0 ? (
              <Card>
                <ThemedText style={[styles.emptyCart, { color: colors.icon }]}>
                  {t("sales.cartEmpty")}
                </ThemedText>
              </Card>
            ) : (
              cart.map((item) => {
                const hasDiscount = item.price < item.barang.barangGrosir;
                return (
                  <TouchableOpacity
                    key={item.barang.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedItemId(item.barang.id);
                      setShowItemMenuModal(true);
                    }}
                  >
                    <Card style={[styles.cartItemCompact, { padding: 8, marginVertical: 0, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: colors.icon + "30" }]}>
                      <View style={styles.cartItemCompactContent}>
                        <View style={styles.cartItemCompactLeft}>
                          <ThemedText
                            type="defaultSemiBold"
                            style={[styles.cartItemCompactName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {item.quantity}/{item.barang.barangUnit} {item.barang.barangNama}
                          </ThemedText>
                          <View style={styles.cartItemCompactPriceRow}>
                            {hasDiscount && (
                              <ThemedText style={[styles.cartItemOriginalPrice, { color: colors.icon }]}>
                                {formatIDR(item.barang.barangGrosir)}
                              </ThemedText>
                            )}
                            <ThemedText style={[styles.cartItemCompactPrice, { color: hasDiscount ? colors.error : colors.primary }]}>
                              {formatIDR(item.price)}/{item.barang.barangUnit}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.cartItemCompactTotal, { color: colors.text }]}
                        >
                          {formatIDR(item.price * item.quantity)}
                        </ThemedText>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Total & Actions */}
          {cart.length > 0 && (
            <Card style={[styles.mobileTotalCard, { padding: 8, marginVertical: 0 }]}>
              <View style={styles.totalRow}>
                <ThemedText type="subtitle" style={{ color: colors.text }}>
                  {t("sales.totalBelanja")}
                </ThemedText>
                <ThemedText type="title" style={{ color: colors.primary }}>
                  {formatIDR(total)}
                </ThemedText>
              </View>
            </Card>
          )}

          {/* Save transaction & Checkout */}
          {cart.length > 0 && (
            <View style={styles.mobileActionsContainer}>
              <Button
                title={t("sales.saveTransaction")}
                onPress={handleSaveTransaction}
                loading={saveDraftLoading}
                variant="outline"
                style={styles.mobileActionButtonSideBySide}
                size="large"
              />
              <Button
                title={`${t("sales.bayar")} (${cart.length})`}
                onPress={handleOpenPaymentModal}
                loading={loading}
                style={styles.mobileActionButtonSideBySide}
                size="large"
              />
            </View>
          )}

          {/* Printer status & connect */}
          <Card
            style={StyleSheet.flatten([
              styles.printerCard,
              {
                backgroundColor: thermalPrinter.isConnected()
                  ? "rgba(76, 175, 80, 0.12)"
                  : "rgba(255, 182, 193, 0.5)",
                padding: 8,
                marginVertical: 0,
              },
            ])}
          >
            <View style={styles.printerStatusRow}>
              <Ionicons
                name={thermalPrinter.isConnected() ? "checkmark-circle" : "close-circle"}
                size={20}
                color={thermalPrinter.isConnected() ? "#4CAF50" : colors.icon}
              />
              <ThemedText style={[styles.printerStatusText, { color: colors.text }]} numberOfLines={1}>
                {t("sales.printer")}: {thermalPrinter.isConnected()
                  ? thermalPrinter.getConnectionStatus().device?.name ?? t("sales.connected")
                  : t("sales.notConnected")}
              </ThemedText>
              <TouchableOpacity
                style={[styles.printerConnectButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowPrinterModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.printerConnectButtonText}>
                  {thermalPrinter.isConnected() ? t("sales.ganti") : t("sales.hubungkan")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      ) : (
        /* Desktop/Tablet Layout: Side by side */
        <View style={styles.mainContainer}>
          {/* Left Side: Cart (65%) */}
          <View style={styles.cartContainer}>
            <ScrollView
              style={styles.cartScrollView}
              contentContainerStyle={styles.cartScrollContent}
            >
              {cart.length === 0 ? (
                <Card>
                  <ThemedText style={[styles.emptyCart, { color: colors.icon }]}>
                    {t("sales.cartEmpty")}
                  </ThemedText>
                </Card>
              ) : (
                cart.map((item) => {
                  const hasDiscount = item.price < item.barang.barangGrosir;
                  return (
                    <TouchableOpacity
                      key={item.barang.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedItemId(item.barang.id);
                        setShowItemMenuModal(true);
                      }}
                    >
                      <Card style={[styles.cartItemCompact, { padding: 8, marginVertical: 0, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: colors.icon + "30" }]}>
                        <View style={styles.cartItemCompactContent}>
                          <View style={styles.cartItemCompactLeft}>
                            <ThemedText
                              type="defaultSemiBold"
                              style={[styles.cartItemCompactName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {item.quantity}/{item.barang.barangUnit} {item.barang.barangNama}
                            </ThemedText>
                            <View style={styles.cartItemCompactPriceRow}>
                              {hasDiscount && (
                                <ThemedText style={[styles.cartItemOriginalPrice, { color: colors.icon }]}>
                                  {formatIDR(item.barang.barangGrosir)}
                                </ThemedText>
                              )}
                              <ThemedText style={[styles.cartItemCompactPrice, { color: hasDiscount ? colors.error : colors.primary }]}>
                                {formatIDR(item.price)}/{item.barang.barangUnit}
                              </ThemedText>
                            </View>
                          </View>
                          <ThemedText
                            type="defaultSemiBold"
                            style={[styles.cartItemCompactTotal, { color: colors.text }]}
                          >
                            {formatIDR(item.price * item.quantity)}
                          </ThemedText>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>

          {/* Right Side: Wholesale Sale title, Customer Name, Barcode, Printer, Checkout (35%) */}
          <View style={styles.rightContainer}>
            <ScrollView
              style={styles.rightScrollView}
              contentContainerStyle={styles.rightScrollContent}
            >
              {/* Scan Barcode */}
              <Card style={styles.barcodeCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>{t("sales.scanBarcode")}</ThemedText>
                <View style={styles.barcodeInputContainer}>
                  <TextInput
                    ref={barcodeInputRef}
                    style={[
                      styles.barcodeInput,
                      { backgroundColor: colors.cardBackground, color: colors.text },
                    ]}
                    value={barcodeInput}
                    onChangeText={(text) => setBarcodeInput(text)}
                    placeholder={t("sales.enterBarcodeOrScan")}
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
                    style={[styles.scanButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setShowScannerModal(true);
                      setScannerScanned(false);
                    }}
                  >
                    <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addManualButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowManualItemModal(true)}
                  >
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Total Belanja */}
              {cart.length > 0 && (
                <Card style={styles.customerCard}>
                  <View style={styles.totalBelanjaSection}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>
                      {t("sales.totalBelanja")}
                    </ThemedText>
                    <ThemedText type="title" style={{ color: colors.primary, fontSize: 20 }}>
                      {formatIDR(total)} ({cart.length} {t("sales.barang")})
                    </ThemedText>
                  </View>
                </Card>
              )}

              {/* Printer status & connect */}
              <Card
                style={StyleSheet.flatten([
                  styles.printerCard,
                  {
                    backgroundColor: thermalPrinter.isConnected()
                      ? "rgba(76, 175, 80, 0.12)"
                      : "rgba(255, 182, 193, 0.5)",
                  },
                ])}
              >
                <View style={styles.printerStatusRow}>
                  <Ionicons
                    name={thermalPrinter.isConnected() ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={thermalPrinter.isConnected() ? "#4CAF50" : colors.icon}
                  />
                  <ThemedText style={[styles.printerStatusText, { color: colors.text }]}>
                    {t("sales.printer")}: {thermalPrinter.isConnected()
                      ? thermalPrinter.getConnectionStatus().device?.name ?? t("sales.connected")
                      : t("sales.notConnected")}
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.printerConnectButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowPrinterModal(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.printerConnectButtonText}>
                      {thermalPrinter.isConnected() ? t("sales.ganti") : t("sales.hubungkan")}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Save transaction & Checkout */}
              {cart.length > 0 && (
                <>
                  <Card style={styles.checkoutCard}>
                    <Button
                      title={t("sales.saveTransaction")}
                      onPress={handleSaveTransaction}
                      loading={saveDraftLoading}
                      style={StyleSheet.flatten([styles.checkoutButton, { marginBottom: 8 }])}
                      size="large"
                    />
                  </Card>
                  <Card style={styles.checkoutCard}>
                    <Button
                      title={`${t("sales.bayar")} (${cart.length})`}
                      onPress={handleOpenPaymentModal}
                      loading={loading}
                      style={styles.checkoutButton}
                      size="large"
                    />
                  </Card>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <View
          style={[
            styles.modalOverlay,
            Platform.OS === "web" && styles.modalOverlayWeb,
            { backgroundColor: "rgba(0, 0, 0, 0.5)" },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            style={[styles.modalKeyboardView, Platform.OS === "web" && styles.modalKeyboardViewWeb]}
          >
            <View
              style={[
                styles.modalContent,
                Platform.OS === "web" && styles.modalContentWeb,
                { backgroundColor: colors.cardBackground },
              ]}
            >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                {t("sales.bayarBelanjaGrosir")}
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
                    {t("sales.totalBelanja")} ({cart.length} {t("sales.barang")})
                  </ThemedText>
                  <ThemedText type="title" style={{ color: colors.primary }}>
                    {formatIDR(total)}
                  </ThemedText>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  {t("sales.customerName")} *
                </ThemedText>
                <TextInput
                  style={[
                    styles.customerInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: customerNameError ? colors.error : colors.icon + "30",
                      borderWidth: customerNameError ? 2 : 1,
                    },
                  ]}
                  value={customerName}
                  onChangeText={(text) => {
                    setCustomerName(text.toUpperCase());
                    if (customerNameError && text.trim()) setCustomerNameError(false);
                  }}
                  placeholder={t("sales.customerName")}
                  placeholderTextColor={colors.icon}
                  autoCapitalize="characters"
                />
              </Card>

              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  {t("sales.cetakSaatCheckout")}
                </ThemedText>
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
                    {t("sales.cetakNotaGrosir")}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setPrintSuratJalan(!printSuratJalan)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={printSuratJalan ? "checkbox" : "checkbox-outline"}
                    size={22}
                    color={printSuratJalan ? colors.primary : colors.icon}
                  />
                  <ThemedText style={[styles.checkboxLabel, { color: colors.text }]}>
                    Print Surat Jalan
                  </ThemedText>
                </TouchableOpacity>
              </Card>

              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  {t("sales.ukuranNota")}
                </ThemedText>
                <ThemedText style={[styles.checkboxLabel, { color: colors.icon }]}>
                  Default: A4 (Telegram)
                </ThemedText>
              </Card>

              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  Cara Pembayaran (Payment Method)
                </ThemedText>
                <View style={styles.paymentMethodsGrid}>
                  {(["Cash", "QRIS", "BNI", "BRI", "Mandiri"] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodButton,
                        {
                          backgroundColor:
                            paymentMethod === method ? colors.primary : colors.cardBackground,
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

              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  Setoran
                </ThemedText>
                <TextInput
                  style={[
                    styles.amountInput,
                    { backgroundColor: colors.cardBackground, color: colors.text },
                  ]}
                  value={setorGrosir > 0 ? setorGrosir.toString() : ""}
                  onChangeText={(text) => {
                    const value = text.replace(/[^0-9]/g, "");
                    setSetorGrosir(value ? parseInt(value, 10) : 0);
                  }}
                  placeholder="Enter amount paid"
                  placeholderTextColor={colors.icon}
                  keyboardType="numeric"
                />
                <View style={styles.quickAmountButtons}>
                  <TouchableOpacity
                    style={[styles.quickAmountButton, { backgroundColor: colors.primary + "20" }]}
                    onPress={() => setSetorGrosir(total)}
                  >
                    <ThemedText style={{ color: colors.primary }}>{t("sales.bayarLunas")}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickAmountButton, { backgroundColor: colors.error + "20" }]}
                    onPress={() => setSetorGrosir(0)}
                  >
                    <ThemedText style={{ color: colors.error }}>{t("common.hapus")}</ThemedText>
                  </TouchableOpacity>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <View style={styles.dividerRow}>
                  <ThemedText type="subtitle" style={{ color: colors.text }}>
                    {t("sales.setoranLabel")}: {formatIDR(setorGrosir)}
                  </ThemedText>
                </View>
                <View style={[styles.dividerRow, { marginTop: 8 }]}>
                  <ThemedText type="subtitle" style={{ color: colors.text }}>
                    {t("sales.sisaBayaran")}: {formatIDR(sisaBonGrosir)}
                  </ThemedText>
                </View>
              </Card>
            </ScrollView>

            <View style={[styles.modalFooter, Platform.OS === "web" && styles.modalFooterWeb, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title={t("common.batal")}
                onPress={() => setShowPaymentModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title={t("sales.selesaikanPenjualan")}
                onPress={handleCompleteSale}
                loading={loading}
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

      {/* Quantity Calculator Modal */}
      <CalculatorModal
        visible={showQuantityModal}
        initialValue={
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
          setShowQuantityModal(false);
          setSelectedItemId(null);
        }}
      />

      {/* Item Menu Modal */}
      {showItemMenuModal && selectedItemId && (
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.itemMenuOverlay,
            useCenteredModals && styles.itemMenuOverlayCentered,
            { backgroundColor: "rgba(0, 0, 0, 0.5)" },
          ]}
          onPress={() => {
            setShowItemMenuModal(false);
            setSelectedItemId(null);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.itemMenuContent,
              useCenteredModals && styles.itemMenuContentCentered,
              { backgroundColor: colors.cardBackground },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {(() => {
              const selectedItem = cart.find((item) => item.barang.id === selectedItemId);
              if (!selectedItem) return null;

              return (
                <>
                  <View style={styles.itemMenuHeader}>
                    <ThemedText type="subtitle" style={{ color: colors.text }} numberOfLines={2}>
                      {selectedItem.barang.barangNama}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => {
                        setShowItemMenuModal(false);
                        setSelectedItemId(null);
                      }}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemMenuOptions}>
                    <TouchableOpacity
                      style={[styles.itemMenuOption, { borderBottomColor: colors.icon + "20" }]}
                      onPress={() => {
                        setShowItemMenuModal(false);
                        setShowQuantityModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                      <View style={styles.itemMenuOptionText}>
                        <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                          Quantity
                        </ThemedText>
                        <ThemedText style={[styles.itemMenuOptionSubtext, { color: colors.icon }]}>
                          {selectedItem.quantity} {selectedItem.barang.barangUnit}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.itemMenuOption, { borderBottomColor: colors.icon + "20" }]}
                      onPress={() => {
                        setShowItemMenuModal(false);
                        setShowDiscountModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="cut-outline" size={24} color={colors.error} />
                      <View style={styles.itemMenuOptionText}>
                        <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                          Diskon
                        </ThemedText>
                        <ThemedText style={[styles.itemMenuOptionSubtext, { color: colors.icon }]}>
                          {selectedItem.price < selectedItem.barang.barangGrosir
                            ? `${formatIDR(selectedItem.barang.barangGrosir - selectedItem.price)} off`
                            : "Set discount price"}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.itemMenuOption}
                      onPress={() => {
                        if (selectedItemId) {
                          removeFromCart(selectedItemId);
                          setShowItemMenuModal(false);
                          setSelectedItemId(null);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={24} color={colors.error} />
                      <View style={styles.itemMenuOptionText}>
                        <ThemedText type="defaultSemiBold" style={{ color: colors.error }}>
                          Hapus
                        </ThemedText>
                        <ThemedText style={[styles.itemMenuOptionSubtext, { color: colors.icon }]}>
                          Remove from cart
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Discount Calculator Modal */}
      {showDiscountModal && selectedItemId && (() => {
        const selectedItem = cart.find((item) => item.barang.id === selectedItemId);
        if (!selectedItem) return null;

        const currentDiscount = Math.max(
          0,
          selectedItem.barang.barangGrosir - selectedItem.price
        );

        return (
          <CalculatorModal
            visible={true}
            mode="discount"
            initialValue={currentDiscount}
            productName={selectedItem.barang.barangNama}
            originalPrice={selectedItem.barang.barangGrosir}
            onClose={() => {
              setShowDiscountModal(false);
              setSelectedItemId(null);
            }}
            onConfirm={(discount) => {
              const newPrice = Math.max(0, selectedItem.barang.barangGrosir - discount);
              updateItemPrice(selectedItemId, newPrice);
              setShowDiscountModal(false);
              setSelectedItemId(null);
            }}
          />
        );
      })()}

      {/* Manual Item Modal */}
      {showManualItemModal && (
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.modalOverlay,
            Platform.OS === "web" && styles.modalOverlayWeb,
            { backgroundColor: "rgba(0, 0, 0, 0.5)" },
          ]}
          onPress={() => {
            setShowManualItemModal(false);
            setManualItemName("");
            setManualItemPrice("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            style={{ width: "100%" }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.modalContent,
                Platform.OS === "web" && styles.modalContentWeb,
                { backgroundColor: colors.cardBackground },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Tambah Barang Manual
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowManualItemModal(false);
                  setManualItemName("");
                  setManualItemPrice("");
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalScroll}>
              <Card style={styles.modalCard}>
                <ThemedText style={[styles.label, { color: colors.text }]}>
                  Nama Barang
                </ThemedText>
                <TextInput
                  style={[
                    styles.amountInput,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={manualItemName}
                  onChangeText={setManualItemName}
                  placeholder="Barang Tambahan (kosongkan untuk default)"
                  placeholderTextColor={colors.icon}
                  autoCapitalize="characters"
                />
                <ThemedText style={[styles.label, { color: colors.text, marginTop: 12 }]}>
                  Harga (Rp)
                </ThemedText>
                <TextInput
                  style={[
                    styles.amountInput,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={manualItemPrice}
                  onChangeText={(text) => {
                    const value = text.replace(/[^0-9]/g, "");
                    setManualItemPrice(value);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.icon}
                  keyboardType="numeric"
                />
                {manualItemPrice && parseInt(manualItemPrice, 10) > 0 && (
                  <View style={styles.discountPreview}>
                    <ThemedText style={[styles.label, { color: colors.text }]}>
                      Total:
                    </ThemedText>
                    <ThemedText type="title" style={{ color: colors.primary }}>
                      {formatIDR(parseInt(manualItemPrice, 10))}
                    </ThemedText>
                  </View>
                )}
              </Card>
            </View>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title={t("common.batal")}
                onPress={() => {
                  setShowManualItemModal(false);
                  setManualItemName("");
                  setManualItemPrice("");
                }}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Tambah ke Keranjang"
                onPress={addManualItemToCart}
                style={styles.modalButton}
                size="large"
              />
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      )}

      {/* Inline Camera Barcode Scanner Modal - same flow as ProductForm for faster scanning */}
      <Modal
        visible={showScannerModal}
        animationType="slide"
        onRequestClose={() => setShowScannerModal(false)}
      >
        <ThemedView style={styles.scannerModalContainer}>
          <View style={styles.scannerModalHeader}>
            <ThemedText type="title" style={styles.scannerModalTitle}>
              {t("sales.scanBarcode")}
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
                  {t("sales.positionBarcode") || "Position the barcode within the frame"}
                </ThemedText>
                {scannerScanned && (
                  <TouchableOpacity
                    style={[styles.scannerModalRescanBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setScannerScanned(false)}
                  >
                    <ThemedText style={styles.scannerModalGrantBtnText}>
                      {t("sales.tapToScanAgain") || "Tap to Scan Again"}
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  // Mobile layout styles
  mobileScrollView: {
    flex: 1,
  },
  mobileScrollContent: {
    padding: 8,
    paddingBottom: 40,
  },
  mobileCartSection: {
    marginBottom: 4,
  },
  mobileTotalCard: {
    marginBottom: 4,
  },
  mobileActionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  mobileActionButton: {
    width: "100%",
  },
  mobileActionButtonSideBySide: {
    flex: 1,
  },
  // Desktop layout styles
  mainContainer: {
    flex: 1,
    flexDirection: "row",
  },
  cartContainer: {
    width: "65%",
    borderRightWidth: 1,
    borderRightColor: "#E0E0E0",
    padding: 16,
  },
  cartScrollView: {
    flex: 1,
  },
  cartScrollContent: {
    paddingBottom: 20,
  },
  rightContainer: {
    width: "35%",
    flex: 1,
  },
  rightScrollView: {
    flex: 1,
  },
  rightScrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  wholesaleSaleTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  customerCard: {
    marginBottom: 4,
    padding: 4,
  },
  customerTotalRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  customerNameSection: {
    flex: 1,
  },
  totalBelanjaSection: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  customerInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  barcodeCard: {
    marginBottom: 4,
    padding: 4,
  },
  printerCard: {
    marginBottom: 4,
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
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  barcodeInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  barcodeInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  scanButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addManualButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  emptyCart: {
    textAlign: "center",
    padding: 20,
    fontSize: 14,
  },
  cartItem: {
    marginBottom: 12,
  },
  cartItemContent: {
    flexDirection: "column",
    gap: 8,
  },
  cartItemInfo: {
    width: "100%",
  },
  cartItemPrice: {
    fontSize: 11,
    marginTop: 4,
  },
  cartItemActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  quantityText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "center",
  },
  cartItemTotal: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  removeButton: {
    padding: 4,
  },
  // Compact cart item styles
  cartItemCompact: {
    marginBottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cartItemCompactContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cartItemCompactLeft: {
    flex: 1,
    minWidth: 0,
  },
  cartItemCompactName: {
    fontSize: 14,
    marginBottom: 4,
  },
  cartItemCompactPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartItemOriginalPrice: {
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  cartItemCompactPrice: {
    fontSize: 12,
    fontWeight: "600",
  },
  cartItemCompactTotal: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 100,
    textAlign: "right",
  },
  // Item menu modal styles
  itemMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  itemMenuOverlayCentered: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  itemMenuContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 8,
    maxHeight: "60%",
  },
  itemMenuContentCentered: {
    maxWidth: 400,
    width: "100%",
    borderRadius: 16,
    maxHeight: "70%",
  },
  itemMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  itemMenuOptions: {
    paddingTop: 8,
  },
  itemMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  itemMenuOptionText: {
    flex: 1,
  },
  itemMenuOptionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  discountPreview: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    alignItems: "center",
  },
  paymentCard: {
    marginTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkoutCard: {
    marginTop: 16,
  },
  checkoutButton: {
    width: "100%",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  modalOverlayWeb: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalKeyboardView: {
    width: "100%",
  },
  modalKeyboardViewWeb: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  modalContent: {
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalContentWeb: {
    maxWidth: 440,
    width: "100%",
    maxHeight: "85%",
    borderRadius: 16,
    paddingBottom: 0,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  checkboxLabel: {
    fontSize: 15,
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
  modalScroll: {
    maxHeight: "70%",
  },
  modalCard: {
    margin: 16,
    marginBottom: 8,
  },
  paymentMethodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
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
  amountInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginTop: 8,
  },
  quickAmountButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  modalFooterWeb: {
    paddingBottom: 8,
  },
  modalButton: {
    flex: 1,
  },
  dividerRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
});
