import { ProductTable } from "@/components/product-table";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState, ErrorMessage } from "@/components/ui/error-message";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResponsive } from "@/hooks/use-responsive";
import { usePermissions } from "@/hooks/usePermissions";
import { getBarangs } from "@/services/database";
import type { Barang } from "@/types/database";
import { formatIDR } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProductsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isTablet } = useResponsive();
  const { canEditProducts } = usePermissions();

  const [products, setProducts] = useState<Barang[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStock, setFilterStock] = useState<"all" | "inStock" | "outOfStock" | "lowStock">(
    "all"
  );
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const itemsPerPage = 25;

  useEffect(() => {
    loadProducts();
  }, []);

  // Get unique types for filter
  const productTypes = useMemo(() => {
    const types = new Set(products.map((p) => p.barangType));
    return Array.from(types).sort();
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.barangNama.toLowerCase().includes(query) ||
          product.id.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType) {
      filtered = filtered.filter((product) => product.barangType === filterType);
    }

    // Stock filter
    if (filterStock === "inStock") {
      filtered = filtered.filter((product) => product.stockBarang > 0);
    } else if (filterStock === "outOfStock") {
      filtered = filtered.filter((product) => product.stockBarang === 0);
    } else if (filterStock === "lowStock") {
      filtered = filtered.filter((product) => product.stockBarang > 0 && product.stockBarang <= 10);
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.barangNama.localeCompare(b.barangNama);
          break;
        case "price":
          comparison = a.barangHarga - b.barangHarga;
          break;
        case "stock":
          comparison = a.stockBarang - b.stockBarang;
          break;
        case "type":
          comparison = a.barangType.localeCompare(b.barangType);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchQuery, filterType, filterStock, sortBy, sortOrder]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.stockBarang > 0).length;
    const outOfStock = products.filter((p) => p.stockBarang === 0).length;
    const lowStock = products.filter((p) => p.stockBarang > 0 && p.stockBarang <= 10).length;
    return { total, inStock, outOfStock, lowStock };
  }, [products]);

  useEffect(() => {
    // Reset to page 1 when filters/search change
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStock, sortBy, sortOrder]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBarangs();
      setProducts(data);
    } catch (error: any) {
      console.error("Error loading products:", error);
      let errorMessage = "Failed to load products. Please check your connection and try again.";
      if (error?.code === "PGRST301" || error?.status === 406) {
        errorMessage = "Access denied. Please check your permissions or contact administrator.";
      } else if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    loadProducts();
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const toggleSort = (field: "name" | "price" | "stock" | "type") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const clearFilters = () => {
    setFilterType(null);
    setFilterStock("all");
    setSearchQuery("");
    setSortBy("name");
    setSortOrder("asc");
  };

  const hasActiveFilters =
    filterType !== null || filterStock !== "all" || searchQuery.trim() !== "";

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Products
        </ThemedText>
        <View style={styles.headerRight}>
          <View style={styles.viewToggle}>
            <Ionicons
              name="list"
              size={18}
              color={viewMode === "list" ? colors.primary : colors.icon}
            />
            <Switch
              value={viewMode === "table"}
              onValueChange={(value) => setViewMode(value ? "table" : "list")}
              trackColor={{ false: colors.icon + "40", true: colors.primary + "40" }}
              thumbColor={viewMode === "table" ? colors.primary : colors.icon}
            />
            <Ionicons
              name="grid"
              size={18}
              color={viewMode === "table" ? colors.primary : colors.icon}
            />
          </View>
          {canEditProducts && (
            <TouchableOpacity style={styles.addButton} onPress={() => router.push("/products/add")}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsContainer, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: colors.primary }]}>
            {stats.total}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Total</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: colors.success }]}>
            {stats.inStock}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>In Stock</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: colors.error }]}>
            {stats.outOfStock}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Out of Stock</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: colors.warning }]}>
            {stats.lowStock}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Low Stock</ThemedText>
        </View>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={colors.icon} style={styles.searchIcon} />
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: colors.cardBackground, color: colors.text },
            ]}
            placeholder="Search by name or barcode..."
            placeholderTextColor={colors.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: hasActiveFilters ? colors.primary : colors.cardBackground,
              borderColor: colors.primary,
            },
          ]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="options"
            size={20}
            color={hasActiveFilters ? "#FFFFFF" : colors.primary}
          />
          {hasActiveFilters && (
            <View style={styles.filterBadge}>
              <ThemedText style={styles.filterBadgeText}>!</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <View style={[styles.activeFiltersContainer, { backgroundColor: colors.primary + "10" }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            {filterType && (
              <View style={[styles.filterChip, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.filterChipText}>{filterType}</ThemedText>
                <TouchableOpacity onPress={() => setFilterType(null)}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {filterStock !== "all" && (
              <View style={[styles.filterChip, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.filterChipText}>
                  {filterStock === "inStock"
                    ? "In Stock"
                    : filterStock === "outOfStock"
                    ? "Out of Stock"
                    : "Low Stock"}
                </ThemedText>
                <TouchableOpacity onPress={() => setFilterStock("all")}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.clearFiltersButton, { borderColor: colors.primary }]}
              onPress={clearFilters}
            >
              <ThemedText style={[styles.clearFiltersText, { color: colors.primary }]}>
                Clear All
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Sort Bar */}
      <View style={[styles.sortContainer, { backgroundColor: colors.cardBackground }]}>
        <ThemedText style={[styles.sortLabel, { color: colors.icon }]}>Sort:</ThemedText>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "name" && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => toggleSort("name")}
        >
          <ThemedText
            style={[
              styles.sortButtonText,
              { color: sortBy === "name" ? colors.primary : colors.text },
            ]}
          >
            Name
          </ThemedText>
          {sortBy === "name" && (
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
              size={14}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "price" && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => toggleSort("price")}
        >
          <ThemedText
            style={[
              styles.sortButtonText,
              { color: sortBy === "price" ? colors.primary : colors.text },
            ]}
          >
            Price
          </ThemedText>
          {sortBy === "price" && (
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
              size={14}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "stock" && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => toggleSort("stock")}
        >
          <ThemedText
            style={[
              styles.sortButtonText,
              { color: sortBy === "stock" ? colors.primary : colors.text },
            ]}
          >
            Stock
          </ThemedText>
          {sortBy === "stock" && (
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
              size={14}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "type" && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => toggleSort("type")}
        >
          <ThemedText
            style={[
              styles.sortButtonText,
              { color: sortBy === "type" ? colors.primary : colors.text },
            ]}
          >
            Type
          </ThemedText>
          {sortBy === "type" && (
            <Ionicons
              name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
              size={14}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.text }]}>
            Loading products...
          </ThemedText>
        </View>
      ) : error ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ErrorMessage
            title="Failed to Load Products"
            message={error}
            onRetry={loadProducts}
            retryLabel="Retry"
          />
        </ScrollView>
      ) : filteredProducts.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <EmptyState
            title={searchQuery ? "No Products Found" : "No Products Available"}
            message={
              searchQuery
                ? `No products match "${searchQuery}". Try a different search term.`
                : "Get started by adding your first product."
            }
            icon={searchQuery ? "search-outline" : "cube-outline"}
            actionLabel={searchQuery ? undefined : "Add Product"}
            onAction={searchQuery ? undefined : () => router.push("/products/add")}
          />
        </ScrollView>
      ) : viewMode === "table" ? (
        <View style={styles.tableContainer}>
          <ProductTable
            products={paginatedProducts}
            onSort={(column) => {
              const fieldMap: Record<string, "name" | "price" | "stock" | "type"> = {
                id: "name",
                name: "name",
                price: "price",
                grosir: "price",
                bon: "price",
                modal: "price",
                type: "type",
                stock: "stock",
              };
              const field = fieldMap[column] || "name";
              toggleSort(field);
            }}
            sortBy={sortBy}
            sortOrder={sortOrder}
            canEdit={canEditProducts}
          />
          {/* Pagination Controls for Table View */}
          {totalPages > 1 && (
            <View style={[styles.paginationContainer, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { backgroundColor: colors.primary + "20" },
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={currentPage === 1 ? colors.icon : colors.primary}
                />
              </TouchableOpacity>

              <View style={styles.paginationInfo}>
                <ThemedText style={[styles.paginationText, { color: colors.text }]}>
                  Page {currentPage} of {totalPages}
                </ThemedText>
                <ThemedText style={[styles.paginationSubtext, { color: colors.icon }]}>
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of{" "}
                  {filteredProducts.length} products
                </ThemedText>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { backgroundColor: colors.primary + "20" },
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={goToNextPage}
                disabled={currentPage === totalPages}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={currentPage === totalPages ? colors.icon : colors.primary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {paginatedProducts.map((product, index) => (
            <TouchableOpacity
              key={product.id}
              style={[styles.productRow, { backgroundColor: colors.cardBackground }]}
              onPress={() => router.push(`/products/${product.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.productRowContent}>
                <View style={styles.productRowLeft}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.productName, { color: colors.text }]}
                  >
                    {product.barangNama}
                  </ThemedText>
                  <ThemedText style={[styles.productMeta, { color: colors.icon }]}>
                    {product.barangType} • {product.barangUnit}
                  </ThemedText>
                </View>
                <View style={styles.productRowCenter}>
                  <ThemedText style={[styles.productPrice, { color: colors.primary }]}>
                    {formatIDR(product.barangHarga)}
                  </ThemedText>
                </View>
                <View style={styles.productRowRight}>
                  <View
                    style={[
                      styles.stockBadge,
                      {
                        backgroundColor:
                          product.stockBarang === 0
                            ? colors.error + "20"
                            : product.stockBarang <= 10
                            ? colors.warning + "20"
                            : colors.success + "20",
                      },
                    ]}
                  >
                    <Ionicons
                      name="cube-outline"
                      size={14}
                      color={
                        product.stockBarang === 0
                          ? colors.error
                          : product.stockBarang <= 10
                          ? colors.warning
                          : colors.success
                      }
                    />
                    <ThemedText
                      style={[
                        styles.stockText,
                        {
                          color:
                            product.stockBarang === 0
                              ? colors.error
                              : product.stockBarang <= 10
                              ? colors.warning
                              : colors.success,
                        },
                      ]}
                    >
                      {product.stockBarang}
                    </ThemedText>
                  </View>
                  {canEditProducts && (
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: colors.primary + "20" }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${product.id}`);
                      }}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View style={[styles.paginationContainer, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { backgroundColor: colors.primary + "20" },
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={currentPage === 1 ? colors.icon : colors.primary}
                />
              </TouchableOpacity>

              <View style={styles.paginationInfo}>
                <ThemedText style={[styles.paginationText, { color: colors.text }]}>
                  Page {currentPage} of {totalPages}
                </ThemedText>
                <ThemedText style={[styles.paginationSubtext, { color: colors.icon }]}>
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of{" "}
                  {filteredProducts.length} products
                </ThemedText>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { backgroundColor: colors.primary + "20" },
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={goToNextPage}
                disabled={currentPage === totalPages}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={currentPage === totalPages ? colors.icon : colors.primary}
                />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Filters
              </ThemedText>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Stock Filter */}
              <View style={styles.filterSection}>
                <ThemedText style={[styles.filterSectionTitle, { color: colors.text }]}>
                  Stock Status
                </ThemedText>
                <View style={styles.filterOptions}>
                  {(["all", "inStock", "outOfStock", "lowStock"] as const).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor:
                            filterStock === option ? colors.primary : colors.cardBackground,
                          borderColor: filterStock === option ? colors.primary : colors.icon + "30",
                        },
                      ]}
                      onPress={() => setFilterStock(option)}
                    >
                      <ThemedText
                        style={[
                          styles.filterOptionText,
                          {
                            color: filterStock === option ? "#FFFFFF" : colors.text,
                          },
                        ]}
                      >
                        {option === "all"
                          ? "All"
                          : option === "inStock"
                          ? "In Stock"
                          : option === "outOfStock"
                          ? "Out of Stock"
                          : "Low Stock (≤10)"}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Type Filter */}
              <View style={styles.filterSection}>
                <ThemedText style={[styles.filterSectionTitle, { color: colors.text }]}>
                  Category
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeFilterScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.typeFilterOption,
                      {
                        backgroundColor:
                          filterType === null ? colors.primary : colors.cardBackground,
                        borderColor: filterType === null ? colors.primary : colors.icon + "30",
                      },
                    ]}
                    onPress={() => setFilterType(null)}
                  >
                    <ThemedText
                      style={[
                        styles.typeFilterText,
                        {
                          color: filterType === null ? "#FFFFFF" : colors.text,
                        },
                      ]}
                    >
                      All
                    </ThemedText>
                  </TouchableOpacity>
                  {productTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeFilterOption,
                        {
                          backgroundColor:
                            filterType === type ? colors.primary : colors.cardBackground,
                          borderColor: filterType === type ? colors.primary : colors.icon + "30",
                        },
                      ]}
                      onPress={() => setFilterType(type)}
                    >
                      <ThemedText
                        style={[
                          styles.typeFilterText,
                          {
                            color: filterType === type ? "#FFFFFF" : colors.text,
                          },
                        ]}
                      >
                        {type}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.icon + "30" }]}
                onPress={clearFilters}
              >
                <ThemedText style={{ color: colors.text }}>Clear All</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowFilters(false)}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Apply</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  addButton: {
    padding: 8,
  },
  tableContainer: {
    flex: 1,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    paddingLeft: 40,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#EF4444",
  },
  activeFiltersContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filtersScroll: {
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  productRow: {
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  productRowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  productRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 14,
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 11,
  },
  productRowCenter: {
    width: 100,
    alignItems: "flex-end",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
  },
  productRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  stockText: {
    fontSize: 12,
    fontWeight: "500",
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  paginationButtonDisabled: {
    opacity: 0.4,
  },
  paginationInfo: {
    alignItems: "center",
    flex: 1,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  paginationSubtext: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalScroll: {
    maxHeight: 400,
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  typeFilterScroll: {
    flexDirection: "row",
  },
  typeFilterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  typeFilterText: {
    fontSize: 12,
    fontWeight: "500",
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
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
