import React from 'react';
import { StyleSheet, View, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Card } from './ui/card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SalesCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  valueColor?: string;
  imageSource?: ImageSourcePropType;
}

export function SalesCard({
  title,
  value,
  subtitle,
  icon = 'cash-outline',
  iconColor,
  valueColor,
  imageSource,
}: SalesCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const defaultIconColor = iconColor || colors.primaryLight;
  const defaultValueColor = valueColor || colors.primary;

  return (
    <Card style={styles.card}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
          <ThemedText
            style={[styles.value, { color: defaultValueColor }]}
            type="defaultSemiBold">
            {value}
          </ThemedText>
          {subtitle && (
            <ThemedText style={[styles.subtitle, { color: colors.icon }]}>{subtitle}</ThemedText>
          )}
        </View>
        {imageSource ? (
          <View style={styles.iconContainer}>
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
          </View>
        ) : icon ? (
          <View style={[styles.iconContainer, { backgroundColor: `${defaultIconColor}20` }]}>
            <Ionicons name={icon} size={32} color={defaultIconColor} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 4,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.7,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 40,
    height: 40,
  },
});

