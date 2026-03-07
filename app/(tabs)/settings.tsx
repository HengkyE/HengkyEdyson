import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { updateUserProfile } from "@/edysonpos/services/database";
import {
  getBluetoothDevice,
  getPrinterType,
  setBluetoothDevice,
  setPrinterType,
  type BluetoothDevice,
  type PrinterType,
} from "@/edysonpos/services/printer-settings";
import { recreatePrinterService, thermalPrinter } from "@/edysonpos/services/thermal-printer";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { canManageUsers, isAdmin } = usePermissions();
  const { t } = useLanguage();

  // Update name/phone values when profile changes
  React.useEffect(() => {
    if (profile) {
      setNameValue(profile.fullName || "");
      setPhoneValue(profile.phone || "");
    }
  }, [profile]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.fullName || "");
  const [phoneValue, setPhoneValue] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<string | null>(null);
  const [printerType, setPrinterTypeState] = useState<PrinterType>("bluetooth");
  const [bluetoothDevice, setBluetoothDeviceState] = useState<BluetoothDevice | null>(null);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<
    Array<{ id: string; name: string; address?: string }>
  >([]);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);

  // Load printer settings on mount
  useEffect(() => {
    loadPrinterSettings();

    // Periodically check connection status
    const statusInterval = setInterval(() => {
      updateConnectionStatus();
    }, 3000); // Check every 3 seconds

    return () => clearInterval(statusInterval);
  }, []);

  const loadPrinterSettings = async () => {
    try {
      const type = await getPrinterType();
      setPrinterTypeState(type);
      const device = await getBluetoothDevice();
      setBluetoothDeviceState(device);

      // Check current connection status
      updateConnectionStatus();

      // If Bluetooth is selected and device is saved, try auto-connect (native only; on web we don't trigger the picker on load)
      if (type === "bluetooth" && device && Platform.OS !== "web") {
        setTimeout(async () => {
          try {
            if (!thermalPrinter.isConnected()) {
              await thermalPrinter.testConnection();
              console.log("[Settings] Auto-connected to saved Bluetooth device");
              updateConnectionStatus();
            }
          } catch (error) {
            console.warn("[Settings] Auto-connect on mount failed:", error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error loading printer settings:", error);
    }
  };

  const updateConnectionStatus = () => {
    try {
      const isConnected = thermalPrinter.isConnected();
      setPrinterConnected(isConnected);

      if (isConnected) {
        const status = thermalPrinter.getConnectionStatus();
        if (status.device) {
          setConnectedDeviceName(status.device.name);
        } else {
          setConnectedDeviceName(null);
        }
      } else {
        setConnectedDeviceName(null);
      }
    } catch (error) {
      console.warn("[Settings] Error checking connection status:", error);
      setPrinterConnected(false);
      setConnectedDeviceName(null);
    }
  };

  const handlePrinterTypeChange = async (type: PrinterType) => {
    try {
      await setPrinterType(type);
      setPrinterTypeState(type);
      // Recreate printer service with new type
      await recreatePrinterService();
      setPrinterStatus(`Printer type changed to ${type.toUpperCase()}`);

      // If switching to Bluetooth and we have a saved device, try to auto-connect
      if (type === "bluetooth" && bluetoothDevice) {
        try {
          setTestingPrinter(true);
          await thermalPrinter.testConnection();
          setPrinterStatus(`Auto-connected to ${bluetoothDevice.name}`);
        } catch (error) {
          console.warn("Auto-connect failed:", error);
          // Don't show error - user can manually connect
        } finally {
          setTestingPrinter(false);
        }
      }
    } catch (error: any) {
      Alert.alert("Error", `Failed to change printer type: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    Alert.alert(t("settings.logout"), t("settings.logOutConfirm"), [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleTestPrinterConnection = async () => {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      const isConnected = await thermalPrinter.testConnection();
      if (isConnected) {
        setPrinterStatus("Printer connected successfully!");
        Alert.alert("Success", "Printer connection test passed!");
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to connect to printer";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Connection Failed", errorMessage);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleTestPrint = async () => {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      // First ensure connection
      if (!thermalPrinter.isConnected()) {
        await thermalPrinter.testConnection();
      }

      // Print test receipt
      await thermalPrinter.printTestReceipt();
      setPrinterStatus("Test receipt sent to printer!");
      Alert.alert("Success", "Test receipt sent to printer!");
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to print test receipt";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Print Failed", errorMessage);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleTestBluetoothConnection = async () => {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      // Ensure printer type is set to Bluetooth
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }

      const isConnected = await thermalPrinter.testConnection();
      if (isConnected) {
        updateConnectionStatus();
        const status = thermalPrinter.getConnectionStatus();
        const deviceName = status.device?.name || "Bluetooth Printer";
        setPrinterStatus(`Bluetooth printer connected: ${deviceName}`);
        Alert.alert("Success", `Bluetooth printer "${deviceName}" connected successfully!`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to connect to Bluetooth printer";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Connection Failed", errorMessage);
      updateConnectionStatus();
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleTestBluetoothPrint = async () => {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      // Ensure printer type is set to Bluetooth
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }

      // First ensure connection
      if (!thermalPrinter.isConnected()) {
        await thermalPrinter.testConnection();
        updateConnectionStatus();
      }

      // Print test receipt
      await thermalPrinter.printTestReceipt();
      const status = thermalPrinter.getConnectionStatus();
      const deviceName = status.device?.name || "Bluetooth Printer";
      setPrinterStatus(`Test receipt sent to ${deviceName}!`);
      Alert.alert("Success", `Test receipt sent to ${deviceName}!`);
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to print test receipt";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Print Failed", errorMessage);
      updateConnectionStatus();
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleSimpleTestPrint = async () => {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      // Get printer service (will use current printer type setting)
      const printer = thermalPrinter;

      // Ensure connection
      if (!printer.isConnected()) {
        await printer.testConnection();
        updateConnectionStatus();
      }

      // Print a simple test message
      await printer.printTestReceipt();
      const status = printer.getConnectionStatus();
      const deviceName = status.device?.name || "printer";
      setPrinterStatus(`Test print sent to ${deviceName} successfully!`);
      Alert.alert("Success", `Test print sent to ${deviceName}!`);
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to send test print";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Print Failed", errorMessage);
      updateConnectionStatus();
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleScanBluetoothDevices = async () => {
    setScanningBluetooth(true);
    setPrinterStatus(null);
    try {
      // Ensure printer type is set to Bluetooth
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }

      const devices = await thermalPrinter.getAvailablePrinters();
      if (devices.length === 0) {
        Alert.alert(
          "No Devices",
          "No Bluetooth printers found. Make sure your printer is paired and turned on.",
        );
        setPrinterStatus("No Bluetooth printers found");
      } else {
        // Store devices and show selection modal
        setAvailableDevices(
          devices.map((d) => ({
            id: d.id,
            name: d.name,
            address: d.address,
          })),
        );
        setShowDeviceModal(true);
        setPrinterStatus(`Found ${devices.length} Bluetooth printer(s)`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to scan for Bluetooth devices";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Scan Failed", errorMessage);
    } finally {
      setScanningBluetooth(false);
    }
  };

  const handleSelectDevice = async (device: { id: string; name: string; address?: string }) => {
    setShowDeviceModal(false);
    setTestingPrinter(true);
    setPrinterStatus(null);

    try {
      // Ensure printer type is Bluetooth
      if (printerType !== "bluetooth") {
        await handlePrinterTypeChange("bluetooth");
      }

      // Connect to selected device
      await thermalPrinter.connect({
        id: device.id,
        name: device.name,
        address: device.address || device.id,
        type: "bluetooth" as const,
      });

      // Update connection status
      updateConnectionStatus();

      // Save device preference
      await setBluetoothDevice({
        id: device.id,
        name: device.name,
        address: device.address || device.id,
      });

      setBluetoothDeviceState({
        id: device.id,
        name: device.name,
        address: device.address || device.id,
      });

      setPrinterStatus(`Connected to ${device.name}`);
      Alert.alert("Success", `Connected to ${device.name}`);
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to connect to device";
      setPrinterStatus(`Error: ${errorMessage}`);
      Alert.alert("Connection Failed", errorMessage);
      updateConnectionStatus();
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleForgetDevice = async () => {
    try {
      await setBluetoothDevice(null);
      setBluetoothDeviceState(null);

      // Disconnect if connected
      if (thermalPrinter.isConnected()) {
        await thermalPrinter.disconnect();
      }

      setPrinterStatus("Device preference cleared");
      Alert.alert("Success", "Bluetooth device preference cleared");
    } catch (error: any) {
      Alert.alert("Error", `Failed to clear device: ${error.message}`);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {t("settings.settings")}
          </ThemedText>
        </View>

        <Card style={styles.profileCard}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.profileContent}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
              <View style={styles.profileInfo}>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.profileName, { color: colors.text }]}
                >
                  {profile?.fullName || user?.email?.split("@")[0] || "User"}
                </ThemedText>
                <ThemedText style={[styles.emailText, { color: colors.icon }]}>
                  {profile?.email || user?.email || "No email"}
                </ThemedText>
                {profile?.role && (
                  <ThemedText style={[styles.roleText, { color: colors.primary }]}>
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </ThemedText>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.icon} />
            </View>
          </TouchableOpacity>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.account")}
          </ThemedText>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Ionicons name="person-outline" size={24} color={colors.primary} />
              <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                {t("settings.viewProfile")}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
          {canManageUsers && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/users")}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="people-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    {t("settings.manageUsers")}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/users/create")}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="person-add-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    {t("settings.createUserProfiles")}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/")}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemContent}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
              <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                Portfolio
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.printer")}
          </ThemedText>

          {/* Connection Status Display */}
          <View style={styles.connectionStatusContainer}>
            <View style={styles.connectionStatusRow}>
              <Ionicons
                name={printerConnected ? "checkmark-circle" : "close-circle"}
                size={20}
                color={printerConnected ? "#4CAF50" : colors.icon}
              />
              <ThemedText style={[styles.connectionStatusText, { color: colors.text }]}>
                {printerConnected
                  ? `${t("settings.connectedTo")}: ${connectedDeviceName || bluetoothDevice?.name || "Printer"}`
                  : t("settings.notConnected")}
              </ThemedText>
            </View>
          </View>

          {/* Printer Type Selection */}
          <View style={styles.printerTypeContainer}>
            <ThemedText style={[styles.printerTypeLabel, { color: colors.text }]}>
              {t("settings.printerType")}
            </ThemedText>
            <View style={styles.printerTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.printerTypeButton,
                  {
                    backgroundColor: printerType === "usb" ? colors.primary : colors.cardBackground,
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
                    styles.printerTypeButtonText,
                    { color: printerType === "usb" ? "#FFFFFF" : colors.text },
                  ]}
                >
                  USB
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.printerTypeButton,
                  {
                    backgroundColor:
                      printerType === "bluetooth" ? colors.primary : colors.cardBackground,
                    borderColor: printerType === "bluetooth" ? colors.primary : colors.icon + "40",
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
                    styles.printerTypeButtonText,
                    { color: printerType === "bluetooth" ? "#FFFFFF" : colors.text },
                  ]}
                >
                  Bluetooth
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* USB Printer Options */}
          {printerType === "usb" && (
            <>
              {Platform.OS === "web" && (
                <View
                  style={[
                    styles.warningContainer,
                    { backgroundColor: "#FFF3CD", borderColor: "#FFE69C" },
                  ]}
                >
                  <Ionicons name="warning-outline" size={20} color="#856404" />
                  <ThemedText style={[styles.warningText, { color: "#856404" }]}>
                    USB may show &quot;Access Denied&quot; on Windows/macOS if the system printer driver
                    claims the device. Recommended: Switch to Bluetooth above - it works better with
                    web browsers!
                  </ThemedText>
                </View>
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleTestPrinterConnection}
                activeOpacity={0.7}
                disabled={testingPrinter}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="hardware-chip-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    Scan & Connect USB Printer
                  </ThemedText>
                </View>
                {testingPrinter ? (
                  <ThemedText style={[styles.menuItemText, { color: colors.icon, fontSize: 14 }]}>
                    Scanning...
                  </ThemedText>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleTestPrint}
                activeOpacity={0.7}
                disabled={testingPrinter}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="receipt-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    Print Test Receipt (USB)
                  </ThemedText>
                </View>
                {testingPrinter ? (
                  <ThemedText style={[styles.menuItemText, { color: colors.icon, fontSize: 14 }]}>
                    Printing...
                  </ThemedText>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Bluetooth Printer Options */}
          {printerType === "bluetooth" && (
            <>
              {Platform.OS === "web" && (
                <View
                  style={[
                    styles.warningContainer,
                    { backgroundColor: "#D4EDDA", borderColor: "#C3E6CB" },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#155724" />
                  <ThemedText style={[styles.warningText, { color: "#155724" }]}>
                    Recommended: Bluetooth works best with web browsers. Use Chrome or Edge, click
                    &quot;Scan for Printers&quot;, and select your BLE printer (e.g., RPP02N or BP-LITE80D1).
                    No server required!
                  </ThemedText>
                </View>
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleScanBluetoothDevices}
                activeOpacity={0.7}
                disabled={scanningBluetooth || testingPrinter}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="bluetooth-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    Scan for Bluetooth Printers
                  </ThemedText>
                </View>
                {scanningBluetooth ? (
                  <ThemedText style={[styles.menuItemText, { color: colors.icon, fontSize: 14 }]}>
                    Scanning...
                  </ThemedText>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                )}
              </TouchableOpacity>
              {bluetoothDevice && (
                <View style={styles.bluetoothDeviceInfo}>
                  <View style={styles.bluetoothDeviceRow}>
                    <ThemedText style={[styles.bluetoothDeviceText, { color: colors.text }]}>
                      Connected: {bluetoothDevice.name}
                    </ThemedText>
                    <TouchableOpacity onPress={handleForgetDevice} style={styles.forgetButton}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleTestBluetoothConnection}
                activeOpacity={0.7}
                disabled={testingPrinter}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="print-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    Test Bluetooth Connection
                  </ThemedText>
                </View>
                {testingPrinter ? (
                  <ThemedText style={[styles.menuItemText, { color: colors.icon, fontSize: 14 }]}>
                    Testing...
                  </ThemedText>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleTestBluetoothPrint}
                activeOpacity={0.7}
                disabled={testingPrinter}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="receipt-outline" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                    Print Test Receipt (Bluetooth)
                  </ThemedText>
                </View>
                {testingPrinter ? (
                  <ThemedText style={[styles.menuItemText, { color: colors.icon, fontSize: 14 }]}>
                    Printing...
                  </ThemedText>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Simple Test Print Button - Works for both USB and Bluetooth */}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 8 }]}
            onPress={handleSimpleTestPrint}
            activeOpacity={0.7}
            disabled={testingPrinter}
          >
            <View style={styles.menuItemContent}>
              <Ionicons name="print-outline" size={24} color={colors.primary} />
              <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                Simple Test Print
              </ThemedText>
            </View>
            {testingPrinter ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.icon} />
            )}
          </TouchableOpacity>

          {printerStatus && (
            <View style={styles.printerStatusContainer}>
              <ThemedText
                style={[
                  styles.printerStatusText,
                  {
                    color: printerStatus.includes("Error")
                      ? colors.error
                      : printerStatus.includes("Success") || printerStatus.includes("connected")
                        ? "#4CAF50"
                        : colors.text,
                  },
                ]}
              >
                {printerStatus}
              </ThemedText>
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.actions")}
          </ThemedText>
          <View style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
              <ThemedText style={[styles.menuItemText, { color: colors.text }]}>Version</ThemedText>
            </View>
            <ThemedText style={[styles.versionText, { color: colors.icon }]}>
              EdysonPos V3.5 - 13/02/26
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.menuItemContent}>
              <Ionicons name="log-out-outline" size={24} color={colors.error} />
              <ThemedText style={[styles.menuItemText, { color: colors.error }]}>
                {t("settings.logout")}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t("settings.profile")}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={[styles.modalAvatar, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="person" size={48} color={colors.primary} />
              </View>

              <View style={styles.profileDetails}>
                <ThemedText style={[styles.label, { color: colors.icon }]}>
                  {t("settings.name")}
                </ThemedText>
                {editingName ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={[
                        styles.editInput,
                        { backgroundColor: colors.background, color: colors.text },
                      ]}
                      value={nameValue}
                      onChangeText={setNameValue}
                      placeholder="Enter name"
                      placeholderTextColor={colors.icon}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (profile?.id) {
                          setSaving(true);
                          try {
                            await updateUserProfile(profile.id, { fullName: nameValue });
                            await refreshProfile();
                            setEditingName(false);
                          } catch (error) {
                            Alert.alert("Error", "Failed to update name");
                          } finally {
                            setSaving(false);
                          }
                        }
                      }}
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setNameValue(profile?.fullName || "");
                        setEditingName(false);
                      }}
                      style={[styles.cancelButton, { backgroundColor: colors.icon + "20" }]}
                    >
                      <Ionicons name="close" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.valueContainer}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.value, { color: colors.text }]}
                    >
                      {profile?.fullName || user?.email?.split("@")[0] || "User"}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => {
                        setNameValue(profile?.fullName || "");
                        setEditingName(true);
                      }}
                      style={styles.editIcon}
                    >
                      <Ionicons name="pencil" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.divider} />

                <ThemedText style={[styles.label, { color: colors.icon }]}>
                  {t("settings.email")}
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.value, { color: colors.text }]}>
                  {profile?.email || user?.email || "No email"}
                </ThemedText>

                <View style={styles.divider} />

                <ThemedText style={[styles.label, { color: colors.icon }]}>
                  {t("settings.phone")}
                </ThemedText>
                {editingPhone ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={[
                        styles.editInput,
                        { backgroundColor: colors.background, color: colors.text },
                      ]}
                      value={phoneValue}
                      onChangeText={setPhoneValue}
                      placeholder="Enter phone number"
                      placeholderTextColor={colors.icon}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (profile?.id) {
                          setSaving(true);
                          try {
                            await updateUserProfile(profile.id, { phone: phoneValue || null });
                            await refreshProfile();
                            setEditingPhone(false);
                          } catch (error) {
                            Alert.alert("Error", "Failed to update phone");
                          } finally {
                            setSaving(false);
                          }
                        }
                      }}
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setPhoneValue(profile?.phone || "");
                        setEditingPhone(false);
                      }}
                      style={[styles.cancelButton, { backgroundColor: colors.icon + "20" }]}
                    >
                      <Ionicons name="close" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.valueContainer}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.value, { color: colors.text }]}
                    >
                      {profile?.phone || "Not set"}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => {
                        setPhoneValue(profile?.phone || "");
                        setEditingPhone(true);
                      }}
                      style={styles.editIcon}
                    >
                      <Ionicons name="pencil" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.divider} />

                <ThemedText style={[styles.label, { color: colors.icon }]}>
                  {t("settings.role")}
                </ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.value, { color: colors.primary }]}
                >
                  {profile?.role
                    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                    : "Not set"}
                </ThemedText>
              </View>

              <Button
                title={t("settings.logout")}
                onPress={handleLogout}
                loading={saving}
                style={{ ...styles.logoutButton, backgroundColor: colors.error }}
                textStyle={styles.logoutButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Bluetooth Device Selection Modal */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: colors.text }}>
                {t("settings.selectBluetoothPrinter")}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowDeviceModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deviceList}>
              {availableDevices.length === 0 ? (
                <View style={styles.emptyDeviceList}>
                  <ThemedText style={[styles.emptyDeviceText, { color: colors.icon }]}>
                    {t("settings.noPrintersFound")}
                  </ThemedText>
                </View>
              ) : (
                availableDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[
                      styles.deviceItem,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.icon + "20",
                      },
                      bluetoothDevice?.id === device.id && {
                        backgroundColor: colors.primary + "20",
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => handleSelectDevice(device)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.deviceItemContent}>
                      <Ionicons
                        name="bluetooth"
                        size={24}
                        color={bluetoothDevice?.id === device.id ? colors.primary : colors.icon}
                      />
                      <View style={styles.deviceItemInfo}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.deviceItemName, { color: colors.text }]}
                        >
                          {device.name}
                        </ThemedText>
                        {device.address && (
                          <ThemedText style={[styles.deviceItemAddress, { color: colors.icon }]}>
                            {device.address}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    {bluetoothDevice?.id === device.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.icon + "20" }]}
                onPress={() => setShowDeviceModal(false)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.modalButtonText, { color: colors.text }]}>
                  {t("common.cancel")}
                </ThemedText>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  profileCard: {
    marginBottom: 24,
  },
  profileButton: {
    padding: 16,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    alignItems: "center",
  },
  profileName: {
    textAlign: "center",
  },
  emailText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    textAlign: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  profileDetails: {
    marginBottom: 24,
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  value: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 16,
  },
  logoutButton: {
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#FFFFFF",
  },
  versionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editIcon: {
    padding: 4,
  },
  editContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  roleText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
  },
  printerStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  printerStatusText: {
    fontSize: 14,
    textAlign: "center",
  },
  printerTypeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  printerTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  printerTypeButtons: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  printerTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  printerTypeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  bluetoothDeviceInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  bluetoothDeviceText: {
    fontSize: 14,
    textAlign: "center",
  },
  bluetoothDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  forgetButton: {
    padding: 4,
  },
  connectionStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  connectionStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionStatusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  deviceList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  emptyDeviceList: {
    padding: 40,
    alignItems: "center",
  },
  emptyDeviceText: {
    fontSize: 16,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  deviceItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  deviceItemInfo: {
    flex: 1,
  },
  deviceItemName: {
    fontSize: 16,
    marginBottom: 4,
  },
  deviceItemAddress: {
    fontSize: 12,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  modalButton: {
    width: "100%",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
