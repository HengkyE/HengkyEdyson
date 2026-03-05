import React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ProductsTabScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useLanguage();

  const OPTIONS = [
    {
      titleKey: 'products.addNew',
      descKey: 'products.createNew',
      icon: 'add-circle-outline' as const,
      route: '/products/add',
    },
    {
      titleKey: 'products.updateSingle',
      descKey: 'products.scanToLoad',
      icon: 'barcode-outline' as const,
      route: '/products/update-by-scan',
    },
    {
      titleKey: 'products.updateProducts',
      descKey: 'products.editExisting',
      icon: 'create-outline' as const,
      route: '/products',
    },
    {
      titleKey: 'products.viewAll',
      descKey: 'products.browseAll',
      icon: 'list-outline' as const,
      route: '/products',
    },
    {
      titleKey: 'products.stockManagement',
      descKey: 'products.viewManageStock',
      icon: 'layers-outline' as const,
      route: '/products/stock',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="cube-outline" size={56} color={colors.primary} style={styles.icon} />
          <ThemedText type="title" style={styles.title}>
            {t("products.management")}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            {t("products.manageInventory")}
          </ThemedText>
        </View>

        <View style={styles.optionsGrid}>
          {OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.route + option.titleKey}
              style={[styles.optionCard, { backgroundColor: colors.cardBackground, borderColor: colors.icon + '25' }]}
              onPress={() => router.push(option.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name={option.icon} size={32} color={colors.primary} />
              </View>
              <ThemedText type="defaultSemiBold" style={[styles.optionTitle, { color: colors.text }]} numberOfLines={1}>
                {t(option.titleKey)}
              </ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.icon }]} numberOfLines={2}>
                {t(option.descKey)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 140,
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
});
