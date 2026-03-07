import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { CalculatorModal } from '@/edysonpos/components/calculator-modal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatIDR } from '@/utils/currency';

interface CashPaymentCalculatorProps {
  totalAmount: number;
  cashReceived: number;
  onCashReceivedChange: (amount: number) => void;
  onExactAmount: () => void;
}

const DENOMINATIONS = [
  { value: 500000, label: 'Rp 500,000' },
  { value: 100000, label: 'Rp 100,000' },
  { value: 50000, label: 'Rp 50,000' },
  { value: 20000, label: 'Rp 20,000' },
  { value: 10000, label: 'Rp 10,000' },
  { value: 5000, label: 'Rp 5,000' },
  { value: 2000, label: 'Rp 2,000' },
];

export function CashPaymentCalculator({
  totalAmount,
  cashReceived,
  onCashReceivedChange,
  onExactAmount,
}: CashPaymentCalculatorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const change = cashReceived - totalAmount;
  const hasChange = change > 0;

  const [showCalculator, setShowCalculator] = useState(false);

  const handleAddDenomination = (value: number) => {
    onCashReceivedChange(cashReceived + value);
  };

  const handleClear = () => {
    onCashReceivedChange(0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: colors.text }]}>
            Total:
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
            {formatIDR(totalAmount)}
          </ThemedText>
        </View>

        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: colors.text }]}>
            Cash Received:
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
            {formatIDR(cashReceived)}
          </ThemedText>
        </View>

        {/* Manual cash input – opens calculator modal */}
        <View style={styles.manualRow}>
          <ThemedText style={[styles.manualLabel, { color: colors.icon }]}>
            Manual input:
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.manualInput,
              { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
            ]}
            onPress={() => setShowCalculator(true)}
            activeOpacity={0.7}
          >
            <ThemedText style={{ color: cashReceived > 0 ? colors.text : colors.icon }}>
              {cashReceived > 0 ? formatIDR(cashReceived) : '0'}
            </ThemedText>
            <Ionicons name="calculator-outline" size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {showCalculator && (
          <CalculatorModal
            visible={true}
            mode="price"
            initialValue={cashReceived}
            productName="Uang Diterima"
            onClose={() => setShowCalculator(false)}
            onConfirm={(value) => {
              onCashReceivedChange(value);
              setShowCalculator(false);
            }}
          />
        )}

        {hasChange && (
          <View style={[styles.changeRow, { backgroundColor: colors.success + '20' }]}>
            <ThemedText style={[styles.changeLabel, { color: colors.success }]}>
              Change:
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={{ color: colors.success }}>
              {formatIDR(change)}
            </ThemedText>
          </View>
        )}

        {cashReceived > 0 && cashReceived < totalAmount && (
          <View style={[styles.insufficientRow, { backgroundColor: colors.error + '20' }]}>
            <ThemedText style={[styles.insufficientLabel, { color: colors.error }]}>
              Insufficient: {formatIDR(totalAmount - cashReceived)} more needed
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.buttonsSection}>
        <TouchableOpacity
          style={[styles.exactButton, { backgroundColor: colors.primary }]}
          onPress={onExactAmount}
          activeOpacity={0.7}>
          <ThemedText style={styles.exactButtonText}>Uang Pas (Exact Amount)</ThemedText>
        </TouchableOpacity>

        <View style={styles.denominationsGrid}>
          {DENOMINATIONS.map((denom) => (
            <TouchableOpacity
              key={denom.value}
              style={[
                styles.denomButton,
                { backgroundColor: colors.cardBackground, borderColor: colors.icon + '30' },
              ]}
              onPress={() => handleAddDenomination(denom.value)}
              activeOpacity={0.7}>
              <ThemedText style={[styles.denomText, { color: colors.text }]}>
                {denom.label}
              </ThemedText>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.denomButton,
              { backgroundColor: colors.error + '20', borderColor: colors.error },
            ]}
            onPress={handleClear}
            activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <ThemedText style={[styles.denomText, { color: colors.error }]}>
              Clear
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  amountSection: {
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  insufficientRow: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  insufficientLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  manualRow: {
    marginTop: 10,
    gap: 8,
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  buttonsSection: {
    gap: 12,
  },
  exactButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  exactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  denominationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  denomButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  denomText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

