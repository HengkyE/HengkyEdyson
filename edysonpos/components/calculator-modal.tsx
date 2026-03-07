import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface CalculatorModalProps {
  visible: boolean;
  initialValue?: number;
  onClose: () => void;
  onConfirm: (value: number) => void;
  productName?: string;
  /** "quantity" = min 1, "discount" = min 0 + Reset, "price" = min 0 for price fields */
  mode?: "quantity" | "discount" | "price";
  /** For discount mode: original price to show "Harga Setelah Diskon" */
  originalPrice?: number;
}

/** Safely evaluate a calculator expression (digits and + - * / only). Returns NaN if invalid. */
function evaluateExpression(expr: string): number {
  const trimmed = expr.replace(/\s/g, "");
  if (!trimmed) return NaN;
  if (!/^[\d+\-*/.]+$/.test(trimmed)) return NaN;
  try {
    const result = Function(`"use strict"; return (${trimmed})`)();
    return typeof result === "number" ? result : NaN;
  } catch {
    return NaN;
  }
}

const ROWS: { label: string; type: "digit" | "op" | "clear" | "equals" }[][] = [
  [
    { label: "7", type: "digit" },
    { label: "8", type: "digit" },
    { label: "9", type: "digit" },
    { label: "/", type: "op" },
  ],
  [
    { label: "4", type: "digit" },
    { label: "5", type: "digit" },
    { label: "6", type: "digit" },
    { label: "*", type: "op" },
  ],
  [
    { label: "1", type: "digit" },
    { label: "2", type: "digit" },
    { label: "3", type: "digit" },
    { label: "-", type: "op" },
  ],
  [
    { label: "0", type: "digit" },
    { label: ".", type: "digit" },
    { label: "C", type: "clear" },
    { label: "+", type: "op" },
  ],
];

export function CalculatorModal({
  visible,
  initialValue = 1,
  onClose,
  onConfirm,
  productName,
  mode = "quantity",
  originalPrice,
}: CalculatorModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { width } = useWindowDimensions();
  const minVal = mode === "discount" || mode === "price" ? 0 : 1;
  const defaultVal = mode === "discount" || mode === "price" ? 0 : 1;
  const [display, setDisplay] = useState((initialValue ?? defaultVal).toString());

  // Use centered modal on tablet and desktop (e.g. width >= 600) so it appears in the middle
  const useCenteredModal = width >= 600;

  useEffect(() => {
    if (visible) setDisplay((initialValue ?? defaultVal).toString());
  }, [visible, initialValue, defaultVal]);

  const handlePress = (cell: { label: string; type: string }) => {
    if (cell.type === "clear") {
      setDisplay("0");
      return;
    }
    if (cell.type === "equals") {
      const result = evaluateExpression(display);
      const val = Number.isFinite(result)
        ? Math.max(minVal, Math.floor(result))
        : (initialValue ?? defaultVal);
      onConfirm(val);
      onClose();
      return;
    }
    if (cell.type === "digit") {
      setDisplay((prev) => (prev === "0" && cell.label !== "." ? cell.label : prev + cell.label));
      return;
    }
    if (cell.type === "op") {
      setDisplay((prev) => prev + cell.label);
    }
  };

  const result = evaluateExpression(display);
  const showResult = Number.isFinite(result) && display.replace(/\s/g, "").length > 0;
  const resultInteger = showResult
    ? Math.max(minVal, Math.floor(result))
    : null;

  const headerTitle =
    mode === "discount"
      ? (productName ? `Set Diskon - ${productName}` : "Set Diskon")
      : mode === "price"
        ? (productName || "Harga")
        : (productName ? `Quantity: ${productName}` : "Quantity");
  const resultLabel =
    mode === "discount" ? "Diskon (Rp)" : mode === "price" ? "Harga (Rp)" : "Total quantity";

  return (
    <Modal
      visible={visible}
      transparent
      animationType={useCenteredModal ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, useCenteredModal && styles.overlayCenter]}>
        <View
          style={[
            styles.content,
            { backgroundColor: colors.cardBackground },
            useCenteredModal && styles.contentCenter,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.icon + "30" }]}>
            <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
              {headerTitle}
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

            {mode === "discount" && originalPrice != null && (
            <View style={styles.originalPriceRow}>
              <ThemedText style={[styles.resultLabel, { color: colors.icon }]}>
                Harga Normal
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Rp {originalPrice.toLocaleString("id-ID")}
              </ThemedText>
            </View>
          )}
          <View style={[styles.displayWrap, { backgroundColor: colors.background, borderColor: colors.icon + "25" }]}>
            <ThemedText type="title" style={[styles.display, { color: colors.text }]} numberOfLines={1}>
              {display}
            </ThemedText>
            {resultInteger != null && (
              <View style={[styles.resultRow, { borderTopColor: colors.icon + "18" }]}>
                <ThemedText style={[styles.resultLabel, { color: colors.icon }]}>
                  {resultLabel}
                </ThemedText>
                <ThemedText type="subtitle" style={[styles.resultValue, { color: colors.primary }]}>
                  {resultInteger.toLocaleString("id-ID")}
                </ThemedText>
              </View>
            )}
            {mode === "discount" && originalPrice != null && resultInteger != null && resultInteger > 0 && (
              <View style={[styles.resultRow, { borderTopColor: colors.icon + "18", marginTop: 4 }]}>
                <ThemedText style={[styles.resultLabel, { color: colors.icon }]}>
                  Harga Setelah Diskon
                </ThemedText>
                <ThemedText type="subtitle" style={[styles.resultValue, { color: colors.primary }]}>
                  Rp {(originalPrice - resultInteger).toLocaleString("id-ID")}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.keypad}>
            {ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((cell) => (
                  <View key={cell.label} style={styles.keypadCell}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[
                        styles.keyBase,
                        cell.type === "clear" && { backgroundColor: colors.error, borderColor: colors.error },
                        cell.type === "op" && {
                          backgroundColor: colors.primary + "22",
                          borderColor: colors.primary + "55",
                        },
                        cell.type === "digit" && {
                          backgroundColor: colors.background,
                          borderColor: colors.icon + "35",
                        },
                      ]}
                      onPress={() => handlePress(cell)}
                    >
                      <ThemedText
                        style={[
                          styles.keyText,
                          cell.type === "clear" && { color: "#FFF", fontWeight: "700" },
                          cell.type === "op" && { color: colors.primary, fontWeight: "700" },
                          cell.type === "digit" && { color: colors.text },
                        ]}
                      >
                        {cell.label}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
            <View style={styles.keypadRowOk}>
              {mode === "discount" && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.keyReset, { backgroundColor: colors.background, borderColor: colors.icon + "40" }]}
                  onPress={() => setDisplay("0")}
                >
                  <ThemedText style={[styles.keyTextReset, { color: colors.text }]}>Reset</ThemedText>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.keyOk, { backgroundColor: colors.primary }, mode === "discount" && styles.keyOkWithReset]}
                onPress={() => handlePress({ label: "=", type: "equals" })}
              >
                <ThemedText style={styles.keyTextEquals}>
                  {mode === "discount" ? "Simpan Diskon" : mode === "price" ? "Simpan" : "OK"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  overlayCenter: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  contentCenter: {
    maxWidth: 340,
    width: "100%",
    borderRadius: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    paddingRight: 8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  originalPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  displayWrap: {
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-end",
    minHeight: 88,
  },
  display: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  resultValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  keypad: {
    marginTop: 8,
  },
  keypadRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  keypadCell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
  },
  keyBase: {
    flex: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  keypadRowOk: {
    marginTop: 4,
    marginBottom: 0,
    flexDirection: "row",
    gap: 10,
  },
  keyReset: {
    flex: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    minHeight: 52,
    borderWidth: 1.5,
  },
  keyTextReset: {
    fontSize: 16,
    fontWeight: "600",
  },
  keyOk: {
    flex: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    minHeight: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  keyText: {
    fontSize: 20,
    fontWeight: "600",
  },
  keyOkWithReset: {
    flex: 1,
  },
  keyTextEquals: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
