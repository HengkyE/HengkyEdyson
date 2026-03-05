import { ProductForm, type ProductFormData } from '@/components/product-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createBarang, updateBarang } from '@/services/database';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function AddProductScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: ProductFormData) => {
    try {
      setLoading(true);
      await createBarang(
        data.id,
        data.barangNama,
        data.barangUnit,
        data.barangHarga,
        data.barangGrosir,
        data.barangBon,
        data.barangModal,
        data.barangType,
        data.barangNote,
        data.stockBarang,
        data.stockTokoMini,
        'system' // createdBy
      );
      Alert.alert('Success', 'Product created successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error creating product:', error);
      if (error.code === '23505') {
        // Unique constraint violation (barcode already exists)
        Alert.alert('Error', 'A product with this barcode already exists.');
      } else {
        Alert.alert('Error', error?.message || 'Failed to create product. Please try again.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: ProductFormData) => {
    try {
      setLoading(true);
      await updateBarang(data.id, {
        barangNama: data.barangNama,
        barangUnit: data.barangUnit,
        barangHarga: data.barangHarga,
        barangGrosir: data.barangGrosir,
        barangBon: data.barangBon,
        barangModal: data.barangModal,
        barangType: data.barangType,
        barangNote: data.barangNote,
        stockBarang: data.stockBarang,
        stockTokoMini: data.stockTokoMini,
      });
      Alert.alert('Success', 'Product updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', error?.message || 'Failed to update product. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Add Product
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ProductForm
        product={null}
        onSubmit={handleSubmit}
        onUpdate={handleUpdate}
        onCancel={() => router.back()}
        loading={loading}
      />
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
    padding: 8,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
  },
});

