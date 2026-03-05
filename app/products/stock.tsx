import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { getBarangs } from "@/services/database";
import type { Barang } from "@/types/database";
import { Ionicons } from "@expo/vector-icons";

export default function StockManagementScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { canEditProducts } = usePermissions();

  const [products, setProducts] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await getBarangs();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products for stock:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const inStock = products.filter((p) => p.stockBarang > 0).length;
  const outOfStock = products.filter((p) => p.stockBarang === 0).length;
  const lowStock = products.filter((p) => p.stockBarang > 0 && p.stockBarang <= 10).length;

  const getStockLabel = (stock: number) => {
    if (stock === 0) return "Out of stock";
    if (stock <= 10) return "Low stock";
    return "In stock";
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return colors.error;
    if (stock <= 10) return "#F59E0B";
    return colors.success;
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.headerTitle}>
            Stock Management
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
            Loading stock...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.icon + "20" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Stock Management
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: colors.success + "20" }]}>
            <ThemedText style={[styles.summaryNumber, { color: colors.success }]}>{inStock}</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.text }]}>In stock</ThemedText>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: "#F59E0B20" }]}>
            <ThemedText style={[styles.summaryNumber, { color: "#F59E0B" }]}>{lowStock}</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.text }]}>Low stock</ThemedText>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: colors.error + "20" }]}>
            <ThemedText style={[styles.summaryNumber, { color: colors.error }]}>{outOfStock}</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.text }]}>Out of stock</ThemedText>
          </View>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="layers-outline" size={48} color={colors.icon} />
            <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
              No products yet. Add products first.
            </ThemedText>
          </View>
        ) : (
          products.map((product) => (
            <TouchableOpacity
              key={product.id}
              onPress={() => router.push(`/products/${product.id}`)}
              activeOpacity={0.7}
            >
              <Card style={styles.productCard}>
                <View style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.text }} numberOfLines={1}>
                      {product.barangNama}
                    </ThemedText>
                    <ThemedText style={[styles.barcodeText, { color: colors.icon }]}>
                      {product.id}
                    </ThemedText>
                  </View>
                  <View style={styles.stockWrap}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.stockNumber, { color: getStockColor(product.stockBarang) }]}
                    >
                      {product.stockBarang}
                    </ThemedText>
                    <ThemedText style={[styles.stockLabel, { color: colors.icon }]}>
                      {getStockLabel(product.stockBarang)}
                    </ThemedText>
                  </View>
                  {canEditProducts && (
                    <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20 },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  summaryNumber: { fontSize: 20, fontWeight: "700" },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: { fontSize: 14 },
  productCard: { marginBottom: 10, padding: 14 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  productInfo: { flex: 1 },
  barcodeText: { fontSize: 12, marginTop: 2 },
  stockWrap: { alignItems: "flex-end", marginRight: 8 },
  stockNumber: { fontSize: 18 },
  stockLabel: { fontSize: 11, marginTop: 2 },
});
