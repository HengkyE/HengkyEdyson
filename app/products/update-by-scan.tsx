import { ProductForm, type ProductFormData } from "@/edysonpos/components/product-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { deleteBarang, getBarangById, getBarangByBarcode, updateBarang } from "@/edysonpos/services/database";
import type { Barang } from "@/edysonpos/types/database";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function UpdateByScanScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [barcodeInput, setBarcodeInput] = useState("");
  const [loadedProduct, setLoadedProduct] = useState<Barang | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const lookupByBarcode = async (barcode: string) => {
    const trimmed = barcode?.trim().toUpperCase();
    if (!trimmed) return;
    try {
      setLoadingLookup(true);
      const existing = await getBarangByBarcode(trimmed);
      if (existing) {
        setLoadedProduct(existing);
        setBarcodeInput(trimmed);
      } else {
        setLoadedProduct(null);
        setBarcodeInput("");
        if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
          window.alert("Produk tidak ditemukan. Barcode tidak ada dalam sistem.");
        } else {
          Alert.alert("Produk Tidak Ditemukan", "Barcode tidak ada dalam sistem.");
        }
      }
    } catch (e) {
      console.warn("Barcode lookup failed:", e);
      setLoadedProduct(null);
      setBarcodeInput("");
      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert("Gagal memuat produk. Silakan coba lagi.");
      } else {
        Alert.alert("Error", "Gagal memuat produk. Silakan coba lagi.");
      }
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    const code = data.toUpperCase();
    setBarcodeInput(code);
    setShowScanner(false);
    setScanned(false);
    lookupByBarcode(code);
  };

  const handleSubmit = async (data: ProductFormData) => {
    if (!loadedProduct) return;
    try {
      setLoading(true);
      await updateBarang(loadedProduct.id, {
        barangNama: data.barangNama.trim(),
        barangUnit: data.barangUnit,
        barangHarga: data.barangHarga || 0,
        barangGrosir: data.barangGrosir || 0,
        barangBon: data.barangBon || 0,
        barangModal: data.barangModal || 0,
        barangType: data.barangType,
        barangNote: data.barangNote || null,
        stockBarang: data.stockBarang || 0,
        stockTokoMini: data.stockTokoMini || 0,
      });
      const updated = await getBarangById(loadedProduct.id);
      if (updated) setLoadedProduct(updated);
      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert("Produk berhasil diperbarui!");
      } else {
        Alert.alert("Berhasil", "Produk berhasil diperbarui!", [{ text: "OK" }]);
      }
    } catch (error: any) {
      console.error("Error updating product:", error);
      setLoading(false);
      const msg = error?.message || "Gagal memperbarui produk. Silakan coba lagi.";
      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!loadedProduct) return;
    const productName = loadedProduct.barangNama || loadedProduct.id;
    const confirmMessage = `Apakah Anda yakin ingin menghapus produk "${productName}"? Tindakan ini tidak dapat dibatalkan.`;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.confirm) {
      if (window.confirm(confirmMessage)) performDelete();
    } else {
      Alert.alert("Hapus Produk", confirmMessage, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const performDelete = async () => {
    if (!loadedProduct) return;
    try {
      setLoading(true);
      await deleteBarang(loadedProduct.id);
      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert("Produk berhasil dihapus!");
        setTimeout(() => router.back(), 100);
      } else {
        Alert.alert("Berhasil", "Produk berhasil dihapus!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      console.error("Error deleting product:", error);
      setLoading(false);
      const msg = error?.message || "Gagal menghapus produk. Silakan coba lagi.";
      if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Update / Check Product
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.contentWrap}>
      <View style={styles.scanSection}>
        <Card style={[styles.scanCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[
                styles.barcodeInput,
                { backgroundColor: colors.background, color: colors.text },
              ]}
              value={barcodeInput}
              onChangeText={(text) => setBarcodeInput(text.toUpperCase())}
              placeholder="Masukkan kode barcode"
              placeholderTextColor={colors.icon}
              autoCapitalize="characters"
              onSubmitEditing={() => lookupByBarcode(barcodeInput)}
              editable={!loadingLookup}
            />
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowScanner(true)}
              disabled={loadingLookup}
            >
              <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {loadingLookup && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
                Memuat produk...
              </ThemedText>
            </View>
          )}
        </Card>
      </View>

      {loadedProduct && (
        <ProductForm
          product={loadedProduct}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          onDelete={handleDelete}
          loading={loading}
        />
      )}
      </View>

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <ThemedView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <ThemedText type="title" style={styles.scannerTitle}>
              Scan Barcode
            </ThemedText>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowScanner(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {!permission && (
            <View style={styles.scannerContent}>
              <ThemedText style={{ color: colors.text }}>Requesting camera permission...</ThemedText>
            </View>
          )}
          {permission && !permission.granted && (
            <View style={styles.scannerContent}>
              <ThemedText style={{ color: colors.text }}>No access to camera</ThemedText>
              <TouchableOpacity
                style={[styles.grantButton, { backgroundColor: colors.primary }]}
                onPress={requestPermission}
              >
                <ThemedText style={styles.grantButtonText}>Grant Permission</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          {permission?.granted && (
            <View style={styles.scannerContent}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc", "code128", "code39", "code93"],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />
              <View style={styles.scannerOverlay}>
                <View style={[styles.scannerFrame, { borderColor: colors.primary }]} />
                <ThemedText style={[styles.scannerInstruction, { color: "#FFFFFF" }]}>
                  Arahkan barcode ke dalam bingkai
                </ThemedText>
              </View>
            </View>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 8,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24 },
  contentWrap: { flex: 1 },
  scanSection: { padding: 16 },
  scanCard: { padding: 20 },
  scanLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 12,
  },
  barcodeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  barcodeInput: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  scannerContainer: { flex: 1 },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 60,
  },
  scannerTitle: { fontSize: 20 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: 12,
  },
  scannerInstruction: { marginTop: 20, fontSize: 16, textAlign: "center" },
  grantButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  grantButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
