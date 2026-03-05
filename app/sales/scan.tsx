import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBarangByBarcode } from '@/services/database';
import { emitScannedBarcode } from '@/services/scanned-barcode-store';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  // Get the returnTo parameter to know which screen to navigate back to
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    try {
      const cleaned = data.trim().toUpperCase();
      const barang = await getBarangByBarcode(cleaned);
      if (barang) {
        // IMPORTANT:
        // For Grosir, emit the barcode then dismiss back to grosir. We use dismissTo() instead of
        // back() so we always land on grosir even when the stack/focus state is inconsistent
        // (e.g. when the barcode input was not focused, back() could sometimes go to home).
        if (returnTo === 'grosir') {
          emitScannedBarcode({ barcode: cleaned, returnTo: 'grosir' });
          router.dismissTo('/sales/grosir');
          return;
        }

        // Default behavior (Kontan): emit barcode and go back to the SAME sales/new instance.
        // Using replace() would push a NEW sales/new screen (double page). Instead we go back
        // and let the existing screen process the barcode via the event.
        emitScannedBarcode({ barcode: cleaned, returnTo: "kontan" });
        router.back();
      } else {
        Alert.alert('Product Not Found', 'No product found with this barcode.');
        setScanned(false);
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      Alert.alert('Error', 'Failed to find product.');
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>No access to camera</ThemedText>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={requestPermission}>
          <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.cardBackground }]}
            onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.scannerArea}>
          <View style={[styles.scannerFrame, { borderColor: colors.primary }]} />
        </View>
        
        <View style={styles.footer}>
          <ThemedText style={[styles.instruction, { color: '#FFFFFF' }]}>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  scannerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: 12,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  rescanButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
});

