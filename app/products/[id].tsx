import { ProductForm, type ProductFormData } from '@/edysonpos/components/product-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePermissions } from '@/hooks/usePermissions';
import { deleteBarang, getBarangById, updateBarang } from '@/edysonpos/services/database';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { canEditProducts } = usePermissions();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);

  useEffect(() => {
    if (!canEditProducts) {
      Alert.alert('Access Denied', 'You do not have permission to edit products.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [canEditProducts]);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoadingProduct(true);
      console.log('Loading product with ID:', id);
      const data = await getBarangById(id);
      console.log('Product loaded:', data);
      if (!data) {
        Alert.alert('Error', 'Product not found', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setProduct(data);
      console.log('Product state set:', data);
    } catch (error: any) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleSubmit = async (data: ProductFormData) => {
    try {
      setLoading(true);
      console.log('=== handleSubmit in EditProductScreen ===');
      console.log('Updating product with ID:', id);
      console.log('Update data:', JSON.stringify(data, null, 2));
      console.log('Data validation:', {
        hasId: !!data.id,
        hasName: !!data.barangNama,
        nameLength: data.barangNama?.length,
        hasUnit: !!data.barangUnit,
        hasType: !!data.barangType,
      });
      
      // Additional validation before calling API
      if (!data.barangNama || !data.barangNama.trim()) {
        setLoading(false);
        Alert.alert('Validasi Error', 'Nama produk tidak boleh kosong');
        return;
      }
      
      const updated = await updateBarang(id, {
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
      
      console.log('Product updated successfully:', updated);
      setLoading(false);
      
      // Show success message with web compatibility
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Produk berhasil diperbarui!');
        setTimeout(() => router.back(), 100);
      } else {
        Alert.alert('Berhasil', 'Produk berhasil diperbarui!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        status: error?.status,
      });
      
      setLoading(false);
      
      let errorMessage = 'Gagal memperbarui produk. Silakan coba lagi.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code === 'PGRST301' || error?.status === 406) {
        errorMessage = 'Akses ditolak. Silakan periksa izin Anda atau hubungi administrator.';
      } else if (error?.code === '23505') {
        errorMessage = 'Produk dengan barcode ini sudah ada.';
      }
      
      // Show error with web compatibility
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const handleDelete = () => {
    console.log('=== handleDelete called ===');
    console.log('Product:', product);
    console.log('Product ID:', id);
    console.log('Product name:', product?.barangNama);
    
    const productName = product?.barangNama || id;
    const confirmMessage = `Apakah Anda yakin ingin menghapus produk "${productName}"? Tindakan ini tidak dapat dibatalkan.`;
    
    console.log('Showing delete confirmation...');
    console.log('Platform:', Platform.OS);
    
    // Use window.confirm for web compatibility, Alert for native
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm(confirmMessage);
      console.log('User confirmed:', confirmed);
      if (confirmed) {
        performDelete();
      } else {
        console.log('Delete cancelled by user');
      }
    } else {
      Alert.alert(
        'Hapus Produk',
        confirmMessage,
        [
          { text: 'Batal', style: 'cancel', onPress: () => console.log('Delete cancelled') },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      console.log('=== performDelete called ===');
      console.log('Deleting product with ID:', id);
      
      await deleteBarang(id);
      
      console.log('Product deleted successfully');
      setLoading(false);
      
      // Show success message
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('Produk berhasil dihapus!');
        setTimeout(() => router.back(), 100);
      } else {
        Alert.alert('Berhasil', 'Produk berhasil dihapus!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      setLoading(false);
      
      let errorMessage = 'Gagal menghapus produk. Silakan coba lagi.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code === 'PGRST301' || error?.status === 406) {
        errorMessage = 'Akses ditolak. Silakan periksa izin Anda atau hubungi administrator.';
      }
      
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  if (loadingProduct) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.headerTitle}>
            Edit Product
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: colors.icon }}>Loading product...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Edit Product
        </ThemedText>
        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ProductForm
        product={product}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={handleDelete}
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
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

