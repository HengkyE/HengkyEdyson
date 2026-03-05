import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          ...(variant === 'elevated' && styles.elevated),
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    boxShadow: '0px 2px 3.84px 0px rgba(0,0,0,0.1)',
    elevation: 5,
  },
  elevated: {
    boxShadow: '0px 2px 5px 0px rgba(0,0,0,0.15)',
    elevation: 8,
  },
});

