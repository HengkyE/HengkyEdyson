import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export type PaymentMethod = 'Cash' | 'QRIS' | 'BNI' | 'Mandiri';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
}: PaymentMethodSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const paymentMethods: { method: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { method: 'Cash', label: 'Cash', icon: 'cash-outline' },
    { method: 'QRIS', label: 'QRIS', icon: 'qr-code-outline' },
    { method: 'BNI', label: 'BNI', icon: 'card-outline' },
    { method: 'Mandiri', label: 'Mandiri', icon: 'card-outline' },
  ];

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: colors.text }]} type="defaultSemiBold">
        Payment Method
      </ThemedText>
      <View style={styles.methodsContainer}>
        {paymentMethods.map(({ method, label, icon }) => {
          const isSelected = selectedMethod === method;
          return (
            <TouchableOpacity
              key={method}
              style={[
                styles.methodButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.cardBackground,
                  borderColor: isSelected ? colors.primary : colors.icon + '40',
                  borderWidth: 1,
                },
              ]}
              onPress={() => onSelectMethod(method)}
              activeOpacity={0.7}>
              <Ionicons
                name={icon}
                size={20}
                color={isSelected ? '#FFFFFF' : colors.icon}
              />
              <ThemedText
                style={[
                  styles.methodText,
                  { color: isSelected ? '#FFFFFF' : colors.text },
                ]}>
                {label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  methodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

