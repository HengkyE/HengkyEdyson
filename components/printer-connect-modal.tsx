/**
 * Reusable modal to show printer status and connect to a thermal printer
 * during a sale (wholesale or cash). Supports Bluetooth (scan + select) and USB (test connection).
 */

import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getBluetoothDevice,
  getPrinterType,
  setBluetoothDevice,
  setPrinterType,
  type BluetoothDevice,
  type PrinterType,
} from "@/services/printer-settings";
import { thermalPrinter, recreatePrinterService } from "@/services/thermal-printer";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export interface PrinterConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when connection succeeds so parent can refresh */
  onConnected?: () => void;
}

export function PrinterConnectModal({
  visible,
  onClose,
  onConnected,
}: PrinterConnectModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [printerType, setPrinterTypeState] = useState<PrinterType>("bluetooth");
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [bluetoothDevice, setBluetoothDeviceState] = useState<BluetoothDevice | null>(null);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<
    Array<{ id: string; name: string; address?: string }>
  >([]);
  const [showDeviceList, setShowDeviceList] = useState(false);

  const refreshStatus = () => {
    const isConnected = thermalPrinter.isConnected();
    setPrinterConnected(isConnected);
    if (isConnected) {
      const status = thermalPrinter.getConnectionStatus();
      setConnectedDeviceName(status.device?.name ?? null);
    } else {
      setConnectedDeviceName(null);
    }
  };

  useEffect(() => {
    if (visible) {
      (async () => {
        const type = await getPrinterType();
        setPrinterTypeState(type);
        const device = await getBluetoothDevice();
        setBluetoothDeviceState(device);
        refreshStatus();
        setShowDeviceList(false);
        setAvailableDevices([]);
      })();
    }
  }, [visible]);

  const handlePrinterTypeChange = async (type: PrinterType) => {
    if (type === printerType) return;
    try {
      await setPrinterType(type);
      setPrinterTypeState(type);
      await recreatePrinterService();
      refreshStatus();
      setShowDeviceList(false);
      setAvailableDevices([]);
    } catch (error: any) {
      Alert.alert("Error", `Failed to change printer type: ${error?.message}`);
    }
  };

  const handleScanBluetooth = async () => {
    setScanningBluetooth(true);
    setShowDeviceList(false);
    setAvailableDevices([]);
    try {
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }
      const devices = await thermalPrinter.getAvailablePrinters();
      setAvailableDevices(
        devices.map((d) => ({ id: d.id, name: d.name, address: d.address }))
      );
      setShowDeviceList(true);
      if (devices.length === 0) {
        Alert.alert(
          "No Devices",
          "No Bluetooth printers found. Make sure your printer is paired and turned on."
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Scan Failed",
        error?.message ?? "Failed to scan for Bluetooth devices"
      );
    } finally {
      setScanningBluetooth(false);
    }
  };

  const handleSelectDevice = async (device: {
    id: string;
    name: string;
    address?: string;
  }) => {
    setTestingConnection(true);
    setShowDeviceList(false);
    try {
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }
      await thermalPrinter.connect({
        id: device.id,
        name: device.name,
        address: device.address ?? device.id,
        type: "bluetooth",
      });
      await setBluetoothDevice({
        id: device.id,
        name: device.name,
        address: device.address ?? device.id,
      });
      setBluetoothDeviceState({
        id: device.id,
        name: device.name,
        address: device.address ?? device.id,
      });
      refreshStatus();
      onConnected?.();
      Alert.alert("Connected", `Connected to ${device.name}`);
    } catch (error: any) {
      Alert.alert(
        "Connection Failed",
        error?.message ?? "Failed to connect to device"
      );
      refreshStatus();
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestUsbConnection = async () => {
    setTestingConnection(true);
    try {
      if (printerType !== "usb") {
        await handlePrinterTypeChange("usb");
      }
      await thermalPrinter.testConnection();
      refreshStatus();
      onConnected?.();
      Alert.alert("Success", "Printer connected successfully.");
    } catch (error: any) {
      refreshStatus();
      const errorMessage = error?.message || "";
      
      // Check if it's an "Access Denied" error (common WebUSB issue)
      if (errorMessage.includes("Access Denied") || errorMessage.includes("Access denied") || errorMessage.includes("USB Access Denied")) {
        Alert.alert(
          "USB Access Denied",
          "The operating system's printer driver has claimed this USB device, preventing direct access.\n\n" +
          "Recommended Solutions:\n" +
          "1. Switch to Bluetooth (your printer supports BLE)\n" +
          "2. Remove printer from OS settings:\n" +
          "   • Windows: Settings > Devices > Printers & scanners\n" +
          "   • macOS: System Preferences > Printers & Scanners\n" +
          "3. Unplug printer, wait 5 seconds, then plug back in\n\n" +
          "Would you like to switch to Bluetooth now?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Switch to Bluetooth",
              onPress: async () => {
                try {
                  await handlePrinterTypeChange("bluetooth");
                  Alert.alert(
                    "Switched to Bluetooth",
                    "Please scan for Bluetooth printers and connect. Bluetooth works better with web browsers and doesn't require removing the printer from OS settings."
                  );
                } catch (switchError: any) {
                  Alert.alert("Error", `Failed to switch to Bluetooth: ${switchError?.message}`);
                }
              },
            },
          ]
        );
      } else {
        // Generic error handling
        Alert.alert(
          "Connection Failed",
          errorMessage || "Failed to connect to printer. Make sure the printer server is running (npm run printer-server) and the printer is connected via USB."
        );
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const isNarrow = screenWidth < 400 || screenHeight < 500;
  const contentMaxWidth = Math.min(440, screenWidth - 48);
  const contentMaxHeight = Math.min(screenHeight * 0.85, 560);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isNarrow && styles.overlayBottomSheet]}>
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.cardBackground,
              maxWidth: contentMaxWidth,
              maxHeight: contentMaxHeight,
            },
            isNarrow && styles.contentBottomSheet,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.icon + "30" }]}>
            <ThemedText type="title" style={{ color: colors.text }}>
              Printer
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status */}
            <View style={[styles.statusRow, { backgroundColor: colors.background }]}>
              <Ionicons
                name={printerConnected ? "checkmark-circle" : "close-circle"}
                size={22}
                color={printerConnected ? "#4CAF50" : colors.icon}
              />
              <ThemedText style={[styles.statusText, { color: colors.text }]}>
                {printerConnected
                  ? `Connected: ${connectedDeviceName ?? bluetoothDevice?.name ?? "Printer"}`
                  : "Not connected"}
              </ThemedText>
            </View>

            {/* Printer type */}
            <ThemedText style={[styles.label, { color: colors.text }]}>
              Printer type
            </ThemedText>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  {
                    backgroundColor:
                      printerType === "usb" ? colors.primary : colors.background,
                    borderColor: printerType === "usb" ? colors.primary : colors.icon + "40",
                  },
                ]}
                onPress={() => handlePrinterTypeChange("usb")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="hardware-chip-outline"
                  size={20}
                  color={printerType === "usb" ? "#FFFFFF" : colors.text}
                />
                <ThemedText
                  style={[
                    styles.typeButtonText,
                    { color: printerType === "usb" ? "#FFFFFF" : colors.text },
                  ]}
                >
                  USB
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  {
                    backgroundColor:
                      printerType === "bluetooth" ? colors.primary : colors.background,
                    borderColor:
                      printerType === "bluetooth" ? colors.primary : colors.icon + "40",
                  },
                ]}
                onPress={() => handlePrinterTypeChange("bluetooth")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="bluetooth-outline"
                  size={20}
                  color={printerType === "bluetooth" ? "#FFFFFF" : colors.text}
                />
                <ThemedText
                  style={[
                    styles.typeButtonText,
                    {
                      color: printerType === "bluetooth" ? "#FFFFFF" : colors.text,
                    },
                  ]}
                >
                  Bluetooth
                </ThemedText>
              </TouchableOpacity>
            </View>

            {printerType === "usb" && (
              <>
                {Platform.OS === "web" && (
                  <View
                    style={[
                      styles.hint,
                      { backgroundColor: colors.primary + "15", borderColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                    <ThemedText style={[styles.hintText, { color: colors.text }]}>
                      Run the printer server (npm run printer-server) and connect the printer via USB.
                    </ThemedText>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleTestUsbConnection}
                  disabled={testingConnection}
                  activeOpacity={0.7}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="print-outline" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.actionButtonText}>
                        Connect USB printer
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {printerType === "bluetooth" && (
              <>
                {Platform.OS === "web" && (
                  <View
                    style={[
                      styles.hint,
                      { backgroundColor: colors.primary + "15", borderColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="bluetooth-outline" size={18} color={colors.primary} />
                    <ThemedText style={[styles.hintText, { color: colors.text }]}>
                      Use Chrome or Edge. Scan and select your BLE thermal printer.
                    </ThemedText>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleScanBluetooth}
                  disabled={scanningBluetooth || testingConnection}
                  activeOpacity={0.7}
                >
                  {scanningBluetooth ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="bluetooth-outline" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.actionButtonText}>
                        Scan for printers
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                {showDeviceList && availableDevices.length > 0 && (
                  <View style={styles.deviceList}>
                    <ThemedText style={[styles.deviceListTitle, { color: colors.text }]}>
                      Select a printer
                    </ThemedText>
                    {availableDevices.map((device) => (
                      <TouchableOpacity
                        key={device.id}
                        style={[
                          styles.deviceItem,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.icon + "30",
                          },
                        ]}
                        onPress={() => handleSelectDevice(device)}
                        disabled={testingConnection}
                        activeOpacity={0.7}
                      >
                        <View style={styles.deviceItemContent}>
                          <Ionicons name="bluetooth" size={22} color={colors.primary} />
                          <View>
                            <ThemedText
                              type="defaultSemiBold"
                              style={{ color: colors.text }}
                            >
                              {device.name}
                            </ThemedText>
                            {device.address && (
                              <ThemedText style={[styles.deviceAddress, { color: colors.icon }]}>
                                {device.address}
                              </ThemedText>
                            )}
                          </View>
                        </View>
                        {testingConnection ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.icon + "30" }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.icon + "20" }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>
                Done
              </ThemedText>
            </TouchableOpacity>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  overlayBottomSheet: {
    justifyContent: "flex-end",
    alignItems: "stretch",
    padding: 0,
  },
  content: {
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  contentBottomSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    flexGrow: 0,
    maxHeight: 320,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  deviceList: {
    marginTop: 8,
  },
  deviceListTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  deviceItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  deviceAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
