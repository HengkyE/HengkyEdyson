import React from 'react';
import { StyleSheet, TouchableOpacity, View, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  imageSource?: ImageSourcePropType;
  onPress: () => void;
  variant?: 'default' | 'primary';
}

export function QuickActionCard({
  title,
  description,
  icon,
  iconColor,
  imageSource,
  onPress,
  variant = 'default',
}: QuickActionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? colors.primary : colors.cardBackground;
  const textColor = isPrimary ? '#FFFFFF' : colors.text;
  const descriptionColor = isPrimary ? '#FFFFFF' : colors.icon;
  const defaultIconColor = iconColor || (isPrimary ? '#FFFFFF' : colors.secondary);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: colors.icon + '20',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="contain" />
        ) : icon ? (
          <Ionicons name={icon} size={32} color={defaultIconColor} />
        ) : null}
      </View>
      <ThemedText
        style={[styles.title, { color: textColor }]}
        type="defaultSemiBold">
        {title}
      </ThemedText>
      <ThemedText style={[styles.description, { color: descriptionColor }]}>
        {description}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    margin: 6,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
    boxShadow: '0px 2px 3.84px 0px rgba(0,0,0,0.1)',
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
});

