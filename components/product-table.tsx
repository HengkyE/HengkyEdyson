import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from './themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatIDR } from '@/utils/currency';
import type { Barang } from '@/edysonpos/types/database';
import { useRouter } from 'expo-router';

interface ProductTableProps {
  products: Barang[];
  onSort?: (column: string) => void;
  sortBy?: 'name' | 'price' | 'stock' | 'type';
  sortOrder?: 'asc' | 'desc';
  canEdit?: boolean;
}

export function ProductTable({ products, onSort, sortBy, sortOrder, canEdit = true }: ProductTableProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const renderSortIcon = (column: string) => {
    // Map column names to sortBy values
    const columnMap: Record<string, 'name' | 'price' | 'stock' | 'type'> = {
      id: 'name',
      name: 'name',
      price: 'price',
      grosir: 'price',
      bon: 'price',
      modal: 'price',
      type: 'type',
      stock: 'stock',
    };
    const mappedSortBy = columnMap[column];
    if (!sortBy || sortBy !== mappedSortBy) return null;
    return (
      <Ionicons
        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
        size={12}
        color={colors.primary}
        style={{ marginLeft: 4 }}
      />
    );
  };

  const handleSort = (column: string) => {
    if (onSort) {
      onSort(column);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Table Header */}
          <View style={[styles.headerRow, { backgroundColor: colors.primary + '10' }]}>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellBarcode]}
              onPress={() => handleSort('id')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Barcode
              </ThemedText>
              {renderSortIcon('id')}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellName]}
              onPress={() => handleSort('name')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Nama
              </ThemedText>
              {renderSortIcon('name')}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellPrice]}
              onPress={() => handleSort('price')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Harga Kontan
              </ThemedText>
              {renderSortIcon('price')}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellPrice]}
              onPress={() => handleSort('grosir')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Harga Grosir
              </ThemedText>
              {renderSortIcon('grosir')}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellPrice]}
              onPress={() => handleSort('bon')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Harga Bon
              </ThemedText>
              {renderSortIcon('bon')}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellPrice]}
              onPress={() => handleSort('modal')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Modal
              </ThemedText>
              {renderSortIcon('modal')}
            </TouchableOpacity>
            <View style={[styles.headerCell, styles.cellNote]}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Catatan
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.headerCell, styles.cellType]}
              onPress={() => handleSort('type')}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Type
              </ThemedText>
              {renderSortIcon('type')}
            </TouchableOpacity>
            <View style={[styles.headerCell, styles.cellStock]}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Stock Toko
              </ThemedText>
            </View>
            <View style={[styles.headerCell, styles.cellStock]}>
              <ThemedText style={[styles.headerText, { color: colors.text }]}>
                Stock Mini
              </ThemedText>
            </View>
            {canEdit && (
              <View style={[styles.headerCell, styles.cellActions]}>
                <ThemedText style={[styles.headerText, { color: colors.text }]}>
                  Actions
                </ThemedText>
              </View>
            )}
          </View>

          {/* Table Rows */}
          {products.map((product, index) => (
            <View
              key={product.id}
              style={[
                styles.dataRow,
                {
                  backgroundColor: index % 2 === 0 ? colors.cardBackground : colors.background,
                  borderBottomColor: colors.icon + '20',
                },
              ]}>
              <View style={[styles.dataCell, styles.cellBarcode]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                  {product.id}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellName]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                  {product.barangNama}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellPrice]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]}>
                  {formatIDR(product.barangHarga)}/{product.barangUnit}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellPrice]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]}>
                  {formatIDR(product.barangGrosir)}/{product.barangUnit}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellPrice]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]}>
                  {formatIDR(product.barangBon)}/{product.barangUnit}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellPrice]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]}>
                  {formatIDR(product.barangModal)}/{product.barangUnit}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellNote]}>
                <ThemedText
                  style={[styles.cellText, { color: colors.icon }]}
                  numberOfLines={1}>
                  {product.barangNote || 'Na'}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellType]}>
                <ThemedText style={[styles.cellText, { color: colors.text }]}>
                  {product.barangType}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellStock]}>
                <ThemedText
                  style={[
                    styles.cellText,
                    {
                      color:
                        product.stockBarang === 0
                          ? colors.error
                          : product.stockBarang <= 10
                            ? colors.warning
                            : colors.success,
                    },
                  ]}>
                  {product.stockBarang}
                </ThemedText>
              </View>
              <View style={[styles.dataCell, styles.cellStock]}>
                <ThemedText
                  style={[
                    styles.cellText,
                    {
                      color:
                        product.stockTokoMini === 0
                          ? colors.error
                          : product.stockTokoMini <= 10
                            ? colors.warning
                            : colors.success,
                    },
                  ]}>
                  {product.stockTokoMini}
                </ThemedText>
              </View>
              {canEdit && (
                <View style={[styles.dataCell, styles.cellActions]}>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => router.push(`/products/${product.id}`)}>
                      <Ionicons name="pencil" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    minHeight: 400,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 50,
  },
  dataCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Column widths
  cellBarcode: {
    width: 120,
    minWidth: 120,
  },
  cellName: {
    width: 200,
    minWidth: 200,
  },
  cellPrice: {
    width: 130,
    minWidth: 130,
  },
  cellNote: {
    width: 150,
    minWidth: 150,
  },
  cellType: {
    width: 100,
    minWidth: 100,
  },
  cellStock: {
    width: 90,
    minWidth: 90,
    alignItems: 'center',
  },
  cellActions: {
    width: 80,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

