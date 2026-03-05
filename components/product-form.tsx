import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { CalculatorModal } from './calculator-modal';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PRODUCT_UNITS, type ProductUnit } from '@/constants/product-units';
import { PRODUCT_TYPES, type ProductType } from '@/constants/product-types';
import { getBarangByBarcode } from '@/services/database';
import { formatIDR } from '@/utils/currency';
import type { Barang } from '@/types/database';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface ProductFormProps {
  product?: Barang | null;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onUpdate?: (data: ProductFormData) => Promise<void>; // Called when updating an existing product
  onCancel: () => void;
  onDelete?: () => void;
  loading?: boolean;
}

export interface ProductFormData {
  id: string; // barcode
  barangNama: string;
  barangUnit: ProductUnit;
  barangHarga: number;
  barangGrosir: number;
  barangBon: number;
  barangModal: number;
  barangType: ProductType;
  barangNote: string;
  stockBarang: number;
  stockTokoMini: number;
}

export function ProductForm({ product, onSubmit, onUpdate, onCancel, onDelete, loading }: ProductFormProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [formData, setFormData] = useState<ProductFormData>({
    id: product?.id || '',
    barangNama: product?.barangNama || '',
    barangUnit: (product?.barangUnit as ProductUnit) || 'Pcs',
    barangHarga: product?.barangHarga || 0,
    barangGrosir: product?.barangGrosir || 0,
    barangBon: product?.barangBon || 0,
    barangModal: product?.barangModal || 0,
    barangType: (product?.barangType as ProductType) || 'Lainnya',
    barangNote: product?.barangNote || '',
    stockBarang: product?.stockBarang || 0,
    stockTokoMini: product?.stockTokoMini || 0,
  });

  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [priceFieldModal, setPriceFieldModal] = useState<'barangHarga' | 'barangGrosir' | 'barangBon' | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  // Track if we found an existing product during barcode lookup (for add mode)
  const [existingProductFound, setExistingProductFound] = useState(false);
  const barcodeInputRef = useRef(formData.id);

  // Camera permissions hook
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    barcodeInputRef.current = formData.id;
  }, [formData.id]);

  /** When adding (no product), check if barcode exists and fill form if so. */
  const lookupByBarcode = async (barcode: string) => {
    const trimmed = barcode?.trim();
    if (!trimmed || product != null) return;
    try {
      setLookingUpBarcode(true);
      const existing = await getBarangByBarcode(trimmed);
      if (existing) {
        setFormData({
          id: existing.id || trimmed,
          barangNama: existing.barangNama || '',
          barangUnit: (existing.barangUnit as ProductUnit) || 'Pcs',
          barangHarga: existing.barangHarga || 0,
          barangGrosir: existing.barangGrosir || 0,
          barangBon: existing.barangBon || 0,
          barangModal: existing.barangModal || 0,
          barangType: (existing.barangType as ProductType) || 'Lainnya',
          barangNote: existing.barangNote || '',
          stockBarang: existing.stockBarang ?? 0,
          stockTokoMini: existing.stockTokoMini ?? 0,
        });
        setExistingProductFound(true);
      } else {
        // Barcode not found - it's a new product
        setExistingProductFound(false);
      }
    } catch (e) {
      console.warn('Barcode lookup failed:', e);
      setExistingProductFound(false);
    } finally {
      setLookingUpBarcode(false);
    }
  };

  // Sync formData when product changes (e.g., when product loads)
  useEffect(() => {
    if (product) {
      console.log('Product loaded, updating formData:', product);
      setFormData({
        id: product.id || '',
        barangNama: product.barangNama || '',
        barangUnit: (product.barangUnit as ProductUnit) || 'Pcs',
        barangHarga: product.barangHarga || 0,
        barangGrosir: product.barangGrosir || 0,
        barangBon: product.barangBon || 0,
        barangModal: product.barangModal || 0,
        barangType: (product.barangType as ProductType) || 'Lainnya',
        barangNote: product.barangNote || '',
        stockBarang: product.stockBarang || 0,
        stockTokoMini: product.stockTokoMini || 0,
      });
    }
  }, [product]);

  // Permission is handled by useCameraPermissions hook

  const updateField = (field: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const closePickers = () => {
    setShowUnitPicker(false);
    setShowTypePicker(false);
  };

  const handleClear = () => {
    setFormData({
      id: product?.id || '',
      barangNama: '',
      barangUnit: 'Pcs',
      barangHarga: 0,
      barangGrosir: 0,
      barangBon: 0,
      barangModal: 0,
      barangType: 'Lainnya',
      barangNote: '',
      stockBarang: 0,
      stockTokoMini: 0,
    });
    setExistingProductFound(false);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    const code = data.toUpperCase();
    updateField('id', code);
    setShowScanner(false);
    setScanned(false);
    if (!product) await lookupByBarcode(code);
  };

  const openScanner = () => {
    setShowScanner(true);
    setScanned(false);
  };

  const closeScanner = () => {
    setShowScanner(false);
    setScanned(false);
  };

  const handleSubmit = async (isUpdate: boolean = false) => {
    console.log('=== handleSubmit called ===');
    console.log('Form data:', JSON.stringify(formData, null, 2));
    console.log('Product exists:', !!product);
    console.log('Existing product found:', existingProductFound);
    console.log('Is update:', isUpdate);
    console.log('Form data barangNama:', formData.barangNama);
    console.log('Form data barangNama length:', formData.barangNama?.length);
    
    // Validation with detailed error messages
    if (!formData.id || !formData.id.trim()) {
      console.error('Validation failed: Barcode is empty');
      Alert.alert('Validasi Error', 'Barcode wajib diisi');
      return;
    }
    if (!formData.barangNama || !formData.barangNama.trim()) {
      console.error('Validation failed: Product name is empty');
      Alert.alert('Validasi Error', 'Nama produk wajib diisi');
      return;
    }

    try {
      if (isUpdate && onUpdate) {
        console.log('Validation passed, calling onUpdate with formData...');
        await onUpdate(formData);
        console.log('onUpdate completed successfully');
      } else {
        console.log('Validation passed, calling onSubmit with formData...');
        await onSubmit(formData);
        console.log('onSubmit completed successfully');
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      console.error('Error stack:', error?.stack);
      Alert.alert('Error', error?.message || 'Gagal menyimpan produk');
    }
  };

  return (
    <>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closePickers}
        keyboardShouldPersistTaps="handled"
      >
        {/* Compact Form Layout */}
        <View style={styles.formContainer}>
          {/* Barcode Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Barcode
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.compactInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={formData.id}
                // Avoid forcing text transforms on every keystroke.
                // Some Android/tablet keyboards can duplicate characters when we call `toUpperCase()`
                // inside `onChangeText` while the IME is composing.
                onChangeText={(text) => updateField('id', text)}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                onEndEditing={(e) => {
                  const normalized = (e.nativeEvent.text || '').trim().toUpperCase();
                  if (normalized && normalized !== formData.id) updateField('id', normalized);
                }}
                onBlur={() => {
                  const normalized = (barcodeInputRef.current || '').trim().toUpperCase();
                  if (normalized && normalized !== formData.id) updateField('id', normalized);
                  void lookupByBarcode(normalized);
                }}
                onSubmitEditing={() => {
                  const normalized = (barcodeInputRef.current || '').trim().toUpperCase();
                  if (normalized && normalized !== formData.id) updateField('id', normalized);
                  void lookupByBarcode(normalized);
                }}
                placeholder="Masukkan Kode Barcode Barang"
                placeholderTextColor={colors.icon}
                editable={!product}
              />
            </View>
            {!product && (
              <TouchableOpacity
                style={[styles.scanButton, { backgroundColor: colors.primary }]}
                onPress={openScanner}>
                <Ionicons name="barcode-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Product Name Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Nama
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.compactInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={formData.barangNama}
                // Same approach as barcode: let the keyboard handle capitalization during typing.
                // We normalize to uppercase on blur/end editing to avoid duplicated characters.
                onChangeText={(text) => updateField('barangNama', text)}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                onEndEditing={(e) => {
                  const normalized = (e.nativeEvent.text || '').toUpperCase();
                  if (normalized !== formData.barangNama) updateField('barangNama', normalized);
                }}
                placeholder="Masukkan Nama Barang"
                placeholderTextColor={colors.icon}
              />
            </View>
          </View>


          {/* Unit Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Kategori
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[
                  styles.compactPicker,
                  { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
                ]}
                onPress={() => {
                  setShowUnitPicker(true);
                  setShowTypePicker(false);
                }}>
                <ThemedText style={{ color: colors.text }}>{formData.barangUnit}</ThemedText>
                <Ionicons name="chevron-down" size={16} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Type Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Type
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[
                  styles.compactPicker,
                  { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
                ]}
                onPress={() => {
                  setShowTypePicker(true);
                  setShowUnitPicker(false);
                }}>
                <ThemedText style={{ color: colors.text }}>{formData.barangType}</ThemedText>
                <Ionicons name="chevron-down" size={16} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Harga Kontan Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Harga Kontan
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[
                  styles.compactPicker,
                  { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
                ]}
                onPress={() => {
                  setPriceFieldModal('barangHarga');
                  setShowUnitPicker(false);
                  setShowTypePicker(false);
                }}
              >
                <ThemedText style={{ color: formData.barangHarga > 0 ? colors.text : colors.icon }}>
                  {formData.barangHarga > 0 ? formatIDR(formData.barangHarga) : 'Rp 0'}
                </ThemedText>
                <Ionicons name="calculator-outline" size={18} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Harga Grosir Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Harga Grosir
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[
                  styles.compactPicker,
                  { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
                ]}
                onPress={() => {
                  setPriceFieldModal('barangGrosir');
                  setShowUnitPicker(false);
                  setShowTypePicker(false);
                }}
              >
                <ThemedText style={{ color: formData.barangGrosir > 0 ? colors.text : colors.icon }}>
                  {formData.barangGrosir > 0 ? formatIDR(formData.barangGrosir) : 'Rp 0'}
                </ThemedText>
                <Ionicons name="calculator-outline" size={18} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Harga Bon Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Harga Bon
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[
                  styles.compactPicker,
                  { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
                ]}
                onPress={() => {
                  setPriceFieldModal('barangBon');
                  setShowUnitPicker(false);
                  setShowTypePicker(false);
                }}
              >
                <ThemedText style={{ color: formData.barangBon > 0 ? colors.text : colors.icon }}>
                  {formData.barangBon > 0 ? formatIDR(formData.barangBon) : 'Rp 0'}
                </ThemedText>
                <Ionicons name="calculator-outline" size={18} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Modal Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Modal
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.compactInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={formData.barangModal > 0 ? formatIDR(formData.barangModal) : ''}
                onChangeText={(text) => {
                  const num = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
                  updateField('barangModal', num);
                }}
                placeholder="Rp 0"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Stock Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Stock {formData.barangUnit}
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.compactInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={formData.stockBarang.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
                  updateField('stockBarang', num);
                }}
                placeholder="0"
                placeholderTextColor={colors.icon}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Catatan Row */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Catatan
              </ThemedText>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.compactInput,
                  { backgroundColor: colors.cardBackground, color: colors.text },
                ]}
                value={formData.barangNote}
                onChangeText={(text) => updateField('barangNote', text)}
                placeholder="Masukkan Catatan Barang"
                placeholderTextColor={colors.icon}
              />
            </View>
          </View>
        </View>

        {/* Existing Product Banner - show when adding and barcode matches existing product */}
        {!product && existingProductFound && (
          <View style={[styles.existingProductBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <ThemedText style={[styles.existingProductText, { color: colors.primary }]}>
              Produk dengan barcode ini sudah ada. Anda dapat memperbarui informasi produk.
            </ThemedText>
          </View>
        )}

        {/* Action Buttons */}
        {/* Row 1: Clear | Perbarui or Tambahkan */}
        <View style={styles.actions}>
          <View style={styles.actionsRow1}>
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: colors.icon + '30' }]}
              onPress={handleClear}
              disabled={loading}>
              <ThemedText style={{ color: colors.text }}>Clear</ThemedText>
            </TouchableOpacity>
            {product ? (
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  { backgroundColor: loading ? colors.icon : colors.primary },
                ]}
                onPress={() => handleSubmit(true)}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryActionButtonText}>Perbarui</ThemedText>
                )}
              </TouchableOpacity>
            ) : existingProductFound && onUpdate ? (
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  { backgroundColor: loading ? colors.icon : '#FF9800' },
                ]}
                onPress={() => handleSubmit(true)}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryActionButtonText}>Perbarui Produk</ThemedText>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: loading ? colors.icon : colors.primary }]}
                onPress={() => handleSubmit(false)}
                disabled={loading}>
                <ThemedText style={styles.primaryActionButtonText}>
                  {loading ? 'Loading...' : 'Tambahkan'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {/* Row 2: Hapus (edit) or Batal (add) */}
          <View style={styles.actionsRow2}>
            {product && onDelete ? (
              <TouchableOpacity
                style={[styles.hapusButton, { borderColor: colors.error }]}
                onPress={() => onDelete()}
                disabled={loading}>
                <ThemedText style={[styles.hapusButtonText, { color: colors.error }]}>
                  Hapus
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.hapusButton, { borderColor: colors.icon + '30' }]}
                onPress={onCancel}
                disabled={loading}>
                <ThemedText style={[styles.hapusButtonText, { color: colors.icon }]}>
                  Batal
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Category / Type Picker Modal - scrollable list for tablet */}
      <Modal
        visible={showUnitPicker || showTypePicker}
        transparent
        animationType="fade"
        onRequestClose={closePickers}>
        <Pressable style={styles.pickerModalOverlay} onPress={closePickers}>
          <View style={[styles.pickerModalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.pickerModalHeader, { borderBottomColor: colors.icon + '30' }]}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                {showUnitPicker ? 'Kategori' : 'Type'}
              </ThemedText>
              <TouchableOpacity onPress={closePickers} style={styles.pickerModalClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.pickerModalScroll}
              contentContainerStyle={styles.pickerModalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {showUnitPicker &&
                PRODUCT_UNITS.map((unit) => (
                  <TouchableOpacity
                    key={unit.value}
                    style={[
                      styles.pickerModalOption,
                      {
                        backgroundColor: formData.barangUnit === unit.value ? colors.primary + '20' : 'transparent',
                        borderBottomColor: colors.icon + '20',
                      },
                    ]}
                    onPress={() => {
                      updateField('barangUnit', unit.value);
                      setShowUnitPicker(false);
                    }}
                  >
                    <ThemedText style={{ color: colors.text }}>{unit.label}</ThemedText>
                  </TouchableOpacity>
                ))}
              {showTypePicker &&
                PRODUCT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.pickerModalOption,
                      {
                        backgroundColor: formData.barangType === type.value ? colors.primary + '20' : 'transparent',
                        borderBottomColor: colors.icon + '20',
                      },
                    ]}
                    onPress={() => {
                      updateField('barangType', type.value);
                      setShowTypePicker(false);
                    }}
                  >
                    <ThemedText style={{ color: colors.text }}>{type.label}</ThemedText>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Price Calculator Modal */}
      {priceFieldModal && (
        <CalculatorModal
          visible={true}
          mode="price"
          initialValue={
            priceFieldModal === 'barangHarga'
              ? formData.barangHarga
              : priceFieldModal === 'barangGrosir'
                ? formData.barangGrosir
                : formData.barangBon
          }
          productName={
            priceFieldModal === 'barangHarga'
              ? 'Harga Kontan'
              : priceFieldModal === 'barangGrosir'
                ? 'Harga Grosir'
                : 'Harga Bon'
          }
          onClose={() => setPriceFieldModal(null)}
          onConfirm={(value) => {
            updateField(priceFieldModal, value);
            setPriceFieldModal(null);
          }}
        />
      )}

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={closeScanner}>
        <ThemedView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <ThemedText type="title" style={styles.scannerTitle}>
              Barcode Scanner
            </ThemedText>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.cardBackground }]}
              onPress={closeScanner}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {!permission && (
            <View style={styles.scannerContent}>
              <ThemedText>Requesting camera permission...</ThemedText>
            </View>
          )}
          {permission && !permission.granted && (
            <View style={styles.scannerContent}>
              <ThemedText style={styles.errorText}>No access to camera</ThemedText>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={requestPermission}>
                <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          {permission && permission.granted && (
            <View style={styles.scannerContent}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc', 'code128', 'code39', 'code93'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />
              <View style={styles.scannerOverlay}>
                <View style={[styles.scannerFrame, { borderColor: colors.primary }]} />
                <ThemedText style={[styles.scannerInstruction, { color: '#FFFFFF' }]}>
                  Position the barcode within the frame
                </ThemedText>
                {scanned && (
                  <TouchableOpacity
                    style={[styles.rescanButton, { backgroundColor: colors.primary }]}
                    onPress={() => setScanned(false)}>
                    <ThemedText style={styles.buttonText}>Tap to Scan Again</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  labelContainer: {
    width: 100,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flex: 1,
  },
  compactInput: {
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  compactPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  scanButton: {
    width: 50,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerModalClose: {
    padding: 4,
  },
  pickerModalScroll: {
    maxHeight: 400,
  },
  pickerModalScrollContent: {
    paddingBottom: 16,
  },
  pickerModalOption: {
    padding: 16,
    borderBottomWidth: 1,
  },
  existingProductBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  existingProductText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  actionsRow1: {
    flexDirection: 'row',
    gap: 12,
  },
  actionsRow2: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  primaryActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hapusButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hapusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  scannerTitle: {
    fontSize: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerContent: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: 12,
  },
  scannerInstruction: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  rescanButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
});

