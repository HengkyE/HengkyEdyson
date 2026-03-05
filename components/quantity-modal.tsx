import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface QuantityModalProps {
  visible: boolean;
  currentQuantity: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  productName?: string;
}

const QUICK_INCREMENT = [1, 2, 3, 5, 10, 50, 100, 500, 1000];
const QUICK_SET = [1, 12, 24, 100, 500, 1000];

export function QuantityModal({
  visible,
  currentQuantity,
  onClose,
  onConfirm,
  productName,
}: QuantityModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [quantity, setQuantity] = useState(currentQuantity.toString());
  const { width, height } = useWindowDimensions();
  
  // Responsive: centered modal on larger screens (>= 768px), bottom sheet on mobile
  const isLargeScreen = width >= 768;
  const modalMaxWidth = 450;
  const modalHeight = isLargeScreen ? Math.min(height * 0.7, 550) : height * 0.75;

  const handleIncrement = (value: number) => {
    const newQty = parseInt(quantity, 10) + value;
    setQuantity(Math.max(1, newQty).toString());
  };

  const handleSet = (value: number) => {
    setQuantity(value.toString());
  };

  const handleConfirm = () => {
    const qty = parseInt(quantity, 10) || 1;
    onConfirm(Math.max(1, qty));
    onClose();
  };

  const handleClose = () => {
    setQuantity(currentQuantity.toString());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isLargeScreen ? "fade" : "slide"}
      onRequestClose={handleClose}>
      <View style={[
        styles.modalOverlay,
        isLargeScreen && styles.modalOverlayCenter
      ]}>
        <View style={[
          styles.modalContent,
          { backgroundColor: colors.cardBackground },
          isLargeScreen && {
            maxWidth: modalMaxWidth,
            width: '100%',
            borderRadius: 16,
            maxHeight: modalHeight,
          },
          !isLargeScreen && { height: modalHeight }
        ]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Adjust Quantity
            </ThemedText>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {productName && (
            <View style={styles.productInfo}>
              <ThemedText style={[styles.productName, { color: colors.text }]}>
                {productName}
              </ThemedText>
            </View>
          )}

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Current Quantity Display */}
            <Card style={styles.quantityCard}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Current Quantity
              </ThemedText>
              <View style={styles.quantityInputContainer}>
                <TouchableOpacity
                  style={[styles.quantityButton, { backgroundColor: colors.error }]}
                  onPress={() => {
                    const qty = Math.max(1, parseInt(quantity, 10) - 1);
                    setQuantity(qty.toString());
                  }}>
                  <Ionicons name="remove" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.quantityInput,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={quantity}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setQuantity(num || '1');
                  }}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[styles.quantityButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const qty = parseInt(quantity, 10) + 1;
                    setQuantity(qty.toString());
                  }}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </Card>

            {/* Quick Increment Buttons */}
            <Card style={styles.card}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Quick Add
              </ThemedText>
              <View style={styles.buttonGrid}>
                {QUICK_INCREMENT.map((value) => (
                  <TouchableOpacity
                    key={`inc-${value}`}
                    style={[
                      styles.quickButton,
                      { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                    ]}
                    onPress={() => handleIncrement(value)}>
                    <ThemedText style={[styles.quickButtonText, { color: colors.primary }]}>
                      +{value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* Quick Set Buttons */}
            <Card style={styles.card}>
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Quick Set
              </ThemedText>
              <View style={styles.buttonGrid}>
                {QUICK_SET.map((value) => (
                  <TouchableOpacity
                    key={`set-${value}`}
                    style={[
                      styles.quickButton,
                      {
                        backgroundColor:
                          parseInt(quantity, 10) === value
                            ? colors.primary
                            : colors.primary + '20',
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => handleSet(value)}>
                    <ThemedText
                      style={[
                        styles.quickButtonText,
                        {
                          color:
                            parseInt(quantity, 10) === value ? '#FFFFFF' : colors.primary,
                        },
                      ]}>
                      {value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[
            styles.footer, 
            { borderTopColor: colors.icon + '30' },
            isLargeScreen && styles.footerLargeScreen
          ]}>
            <Button
              title="Cancel"
              onPress={handleClose}
              variant="outline"
              style={styles.footerButton}
            />
            <Button
              title="Confirm"
              onPress={handleConfirm}
              style={styles.footerButton}
              size="large"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  productInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  quantityCard: {
    margin: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  quantityInput: {
    flex: 1,
    minWidth: 80,
    maxWidth: 200,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  footerLargeScreen: {
    paddingBottom: 16,
  },
  footerButton: {
    flex: 1,
  },
});

