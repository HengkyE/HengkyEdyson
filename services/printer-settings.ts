/**
 * Printer Settings Service
 * Manages printer type preference (USB/Bluetooth) using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PRINTER_TYPE_KEY = '@edysonpos:printer_type';
const BLUETOOTH_DEVICE_KEY = '@edysonpos:bluetooth_device';

export type PrinterType = 'usb' | 'bluetooth';

export interface BluetoothDevice {
  id: string;
  name: string;
  address?: string;
}

/**
 * Get the saved printer type preference
 */
export async function getPrinterType(): Promise<PrinterType> {
  try {
    const value = await AsyncStorage.getItem(PRINTER_TYPE_KEY);
    return (value as PrinterType) || 'bluetooth'; // Default to Bluetooth (primary use)
  } catch (error) {
    console.error('Error getting printer type:', error);
    return 'bluetooth';
  }
}

/**
 * Save the printer type preference
 */
export async function setPrinterType(type: PrinterType): Promise<void> {
  try {
    await AsyncStorage.setItem(PRINTER_TYPE_KEY, type);
  } catch (error) {
    console.error('Error saving printer type:', error);
    throw error;
  }
}

/**
 * Get the saved Bluetooth device
 */
export async function getBluetoothDevice(): Promise<BluetoothDevice | null> {
  try {
    const value = await AsyncStorage.getItem(BLUETOOTH_DEVICE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error getting Bluetooth device:', error);
    return null;
  }
}

/**
 * Save the Bluetooth device
 */
export async function setBluetoothDevice(device: BluetoothDevice | null): Promise<void> {
  try {
    if (device) {
      await AsyncStorage.setItem(BLUETOOTH_DEVICE_KEY, JSON.stringify(device));
    } else {
      await AsyncStorage.removeItem(BLUETOOTH_DEVICE_KEY);
    }
  } catch (error) {
    console.error('Error saving Bluetooth device:', error);
    throw error;
  }
}
