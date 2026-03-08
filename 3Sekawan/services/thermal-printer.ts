/**
 * Thermal Printer Service
 * Handles communication with 80mm thermal receipt printer via ESC/POS commands
 * Based on 80MM Thermal Receipt Printer Programmer Manual
 */

import type { PaymentReceiptData, ReceiptData } from "@/utils/receipt-formatter";
import { getCurrentDateTimeIndo } from "@/utils/date";
import { NativeModules, Platform } from "react-native";
import type { PrinterType } from "./printer-settings";

/** Data for printing the sales overview summary report.
 * grosirSetor and grosirSetorByPayment should be by payment received date (from grosirPayments).
 * salesByCashier: for each cashier, their sales broken down by payment method. */
export interface SalesOverviewReportData {
  reportType?: "general" | "billiard";
  dateLabel: string;
  printedAt?: Date;
  printedBy?: string;
  kontanTotal: number;
  kontanByPayment: Record<string, { total: number; count: number }>;
  grosirTotal: number;
  grosirSetor: number;
  grosirSisa: number;
  grosirSetorByPayment: Record<string, { total: number; count: number }>;
  /** Cashier name -> payment method -> { total, count } */
  salesByCashier?: Record<string, Record<string, { total: number; count: number }>>;
}

/** Data for printing billiard table summary report. */
export interface BilliardTableSummaryReportData {
  dateLabel: string;
  printedAt?: Date;
  printedBy?: string;
  tables: Array<{
    tableNumber: number;
    sessions: number;
    totalHours: number;
    totalSales: number;
  }>;
  grandTotalHours: number;
  grandTotalSales: number;
  grandTotalSessions: number;
}

/** Simple data used for billiard table start receipts. */
export interface BilliardStartReceiptData {
  tableNumber: number;
  startAt: string; // ISO
  endAt: string; // ISO
}

/** Data for printing expenses summary report. */
export interface ExpensesSummaryReportData {
  /** Display label for start date (e.g. "Sabtu, 14 Februari 2026") */
  startDateLabel: string;
  /** Display label for end date (e.g. "Minggu, 15 Februari 2026") */
  endDateLabel: string;
  printedAt?: Date;
  printedBy?: string;
  items: Array<{
    category: string;
    description: string | null;
    amount: number;
    date: string;
  }>;
  totalAmount: number;
}

/** Data for billiard payment receipt. */
export interface BilliardPaymentReceiptData {
  tableNumber: number;
  cashierName: string;
  paymentMethod: string;
  hours: number;
  ratePerHour: number;
  totalAmount: number;
  cashReceived?: number;
  changeAmount?: number;
  pricingBreakdown?: Array<{
    hours: number;
    ratePerHour: number;
    amount: number;
  }>;
  startAt: string; // ISO
  endAt: string; // ISO
}

// Import Bluetooth printer library
// We'll try multiple methods to get the native module
// This allows better error handling and works with Expo's native module system
function getReactNativePosPrinter(): any {
  if (Platform.OS === "web") {
    return null;
  }
  
  try {
    // Method 1: Try direct require (works if module is properly linked)
    const module = require("react-native-thermal-pos-printer");
    if (module && (module.init || module.getDeviceList || module.connectPrinter)) {
      console.log("[Printer] Successfully loaded react-native-thermal-pos-printer via require");
      return module;
    }
  } catch (error) {
    console.warn("[Printer] require() failed, trying NativeModules:", error);
  }
  
  try {
    // Method 2: Try via NativeModules (more reliable for some setups)
    const moduleName = "ReactNativePosPrinter";
    if (NativeModules[moduleName]) {
      console.log("[Printer] Found module via NativeModules");
      return NativeModules[moduleName];
    }
    
    // Method 3: Try common module names
    const possibleNames = [
      "ThermalPosPrinter",
      "ThermalPrinter",
      "PosPrinter",
      "ReactNativeThermalPosPrinter"
    ];
    
    for (const name of possibleNames) {
      if (NativeModules[name]) {
        console.log(`[Printer] Found module via NativeModules as ${name}`);
        return NativeModules[name];
      }
    }
  } catch (error) {
    console.warn("[Printer] NativeModules check failed:", error);
  }
  
  // Method 4: Try require with default export
  try {
    const module = require("react-native-thermal-pos-printer").default;
    if (module) {
      console.log("[Printer] Successfully loaded via default export");
      return module;
    }
  } catch (error) {
    // Ignore, we'll return null
  }
  
  console.error("[Printer] react-native-thermal-pos-printer not available. Available NativeModules:", Object.keys(NativeModules));
  return null;
}

// ESC/POS Command Constants
const ESC = 0x1b; // Escape character
const GS = 0x1d; // Group Separator
const DLE = 0x10; // Data Link Escape
const LF = 0x0a; // Line Feed
const HT = 0x09; // Horizontal Tab

/**
 * ESC/POS Command Builder
 * Builds commands according to the printer manual
 */
export class ESCPOSCommands {
  /**
   * Initialize printer (reset to default state)
   */
  static initialize(): Uint8Array {
    return new Uint8Array([ESC, 0x40]); // ESC @
  }

  /**
   * Print and line feed
   */
  static lineFeed(lines: number = 1): Uint8Array {
    const bytes = new Uint8Array(lines);
    bytes.fill(LF);
    return bytes;
  }

  /**
   * Set character spacing (ESC SP n)
   * @param n - Spacing in units of 0.125mm (0-255)
   */
  static setCharacterSpacing(n: number = 0): Uint8Array {
    return new Uint8Array([ESC, 0x20, n]);
  }

  /**
   * Select print mode (ESC ! n)
   * @param options - Print mode options
   */
  static selectPrintMode(options: {
    font?: "A" | "B"; // Font A (12x24) or Font B (9x17)
    emphasized?: boolean;
    doubleHeight?: boolean;
    doubleWidth?: boolean;
    underline?: boolean;
  }): Uint8Array {
    let n = 0;
    if (options.font === "B") n |= 0x01;
    if (options.emphasized) n |= 0x08;
    if (options.doubleHeight) n |= 0x10;
    if (options.doubleWidth) n |= 0x20;
    if (options.underline) n |= 0x80;
    return new Uint8Array([ESC, 0x21, n]);
  }

  /**
   * Set absolute print position (ESC $ nL nH)
   * @param position - Position in dots (0-65535)
   */
  static setAbsolutePosition(position: number): Uint8Array {
    const nL = position & 0xff;
    const nH = (position >> 8) & 0xff;
    return new Uint8Array([ESC, 0x24, nL, nH]);
  }

  /**
   * Turn emphasized mode on/off (ESC E n)
   * @param on - true to turn on, false to turn off
   */
  static setEmphasized(on: boolean): Uint8Array {
    return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
  }

  /**
   * Turn underline mode on/off (ESC - n)
   * @param on - true to turn on, false to turn off
   */
  static setUnderline(on: boolean): Uint8Array {
    return new Uint8Array([ESC, 0x2d, on ? 1 : 0]);
  }

  /**
   * Set line spacing (ESC 2 or ESC 3 n)
   * @param spacing - Spacing in dots (0-255), or undefined for default (ESC 2)
   */
  static setLineSpacing(spacing?: number): Uint8Array {
    if (spacing === undefined) {
      return new Uint8Array([ESC, 0x32]); // Default line spacing
    }
    return new Uint8Array([ESC, 0x33, spacing]);
  }

  /**
   * Set paper top margin (GS P nL nH)
   * @param margin - Margin in dots (0-65535). For 203 DPI printers, ~8 dots = 1mm
   */
  static setTopMargin(margin: number = 80): Uint8Array {
    // GS P nL nH - Set paper top margin
    // margin is in dots, split into low and high bytes
    const nL = margin & 0xff;
    const nH = (margin >> 8) & 0xff;
    return new Uint8Array([GS, 0x50, nL, nH]);
  }

  /**
   * Cut paper (GS V n)
   * @param mode - Cut mode: 0 (full cut), 1 (partial cut), 2 (full cut with feed), 3 (partial cut with feed)
   */
  static cutPaper(mode: number = 0): Uint8Array {
    return new Uint8Array([GS, 0x56, mode]);
  }

  /**
   * Open cash drawer (ESC p m t1 t2)
   * @param pin - Pin number: 0 (pin 2) or 1 (pin 5)
   * @param onTime - Pulse on time in 2ms units (1-255)
   * @param offTime - Pulse off time in 2ms units (1-255)
   */
  static openCashDrawer(pin: number = 0, onTime: number = 50, offTime: number = 50): Uint8Array {
    return new Uint8Array([ESC, 0x70, pin, onTime, offTime]);
  }

  /**
   * Real-time status request (ESC SP n)
   * @param n - Status type (0-255)
   */
  static requestStatus(n: number = 0): Uint8Array {
    return new Uint8Array([ESC, 0x20, n]);
  }

  /**
   * Real-time status transmission (DLE EOT n)
   * @param n - Status type: 1 (printer), 2 (offline), 3 (error), 4 (paper roll sensor)
   */
  static requestRealTimeStatus(n: number = 1): Uint8Array {
    return new Uint8Array([DLE, 0x04, n]);
  }

  /**
   * Print QR Code (GS ( k pL pH cn fn n1 n2)
   * @param data - QR code data string
   * @param size - QR code size (1-40, 0 for auto)
   * @param errorCorrection - Error correction level: 'L' (7%), 'M' (15%), 'Q' (25%), 'H' (30%)
   */
  static printQRCode(
    data: string,
    size: number = 0,
    errorCorrection: "L" | "M" | "Q" | "H" = "M"
  ): Uint8Array {
    const ecLevels = { L: 0, M: 1, Q: 2, H: 3 };
    const ec = ecLevels[errorCorrection];

    // Convert data to bytes
    const dataBytes = new TextEncoder().encode(data);
    const dataLength = dataBytes.length;
    const pL = dataLength & 0xff;
    const pH = (dataLength >> 8) & 0xff;

    // Build command: GS ( k pL pH cn fn n1 n2 d1...dn
    // cn = 49 (0x31) for QR code
    // fn = 65 (0x41) for storing data
    const command = new Uint8Array(8 + dataLength);
    command[0] = GS;
    command[1] = 0x28; // (
    command[2] = 0x6b; // k
    command[3] = pL;
    command[4] = pH;
    command[5] = 0x31; // cn = 49 (QR code)
    command[6] = 0x41; // fn = 65 (store data)
    command[7] = size; // n1 = size
    command[8] = ec; // n2 = error correction level
    command.set(dataBytes, 9);

    return command;
  }

  /**
   * Print QR Code (print stored QR code)
   */
  static printStoredQRCode(): Uint8Array {
    // GS ( k pL pH cn fn
    // cn = 49, fn = 81 (print)
    return new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  }

  /**
   * Print barcode (GS k m d1...dk NUL)
   * @param data - Barcode data string
   * @param type - Barcode type: 0 (UPC-A), 1 (UPC-E), 2 (EAN13), 3 (EAN8), 4 (CODE39), 5 (ITF), 6 (CODABAR), 65 (CODE93), 66 (CODE128), 67 (GS1-128), 70 (GS1 DataBar Omnidirectional), 71 (GS1 DataBar Truncated), 72 (GS1 DataBar Limited), 73 (GS1 DataBar Expanded)
   * @param height - Barcode height in dots (1-255, default: 50)
   * @param width - Barcode width (2-6, default: 2)
   * @param hri - Human Readable Interpretation position: 0 (none), 1 (above), 2 (below), 3 (above and below)
   */
  static printBarcode(
    data: string,
    type: number = 73, // CODE128 (standard ESC/POS code is 73, not 66)
    height: number = 50,
    width: number = 2,
    hri: number = 2 // Print below barcode
  ): Uint8Array {
    const dataBytes = new TextEncoder().encode(data);

    // Set barcode height (GS h n)
    const heightCmd = new Uint8Array([GS, 0x68, height]);
    // Set barcode width (GS w n)
    const widthCmd = new Uint8Array([GS, 0x77, width]);
    // Set HRI position (GS H n)
    const hriCmd = new Uint8Array([GS, 0x48, hri]);

    // Barcode command: GS k m n d1...dk NUL
    // For CODE128 (type 73), format is: GS k 73 n d1...dk NUL
    // where n is the number of bytes
    const barcodeCmd = new Uint8Array(5 + dataBytes.length + 1);
    barcodeCmd[0] = GS;
    barcodeCmd[1] = 0x6b; // k
    barcodeCmd[2] = type; // 73 for CODE128
    barcodeCmd[3] = dataBytes.length; // n - number of bytes
    barcodeCmd.set(dataBytes, 4); // d1...dk - data bytes
    barcodeCmd[4 + dataBytes.length] = 0x00; // NUL terminator

    return ESCPOSCommands.combine(heightCmd, widthCmd, hriCmd, barcodeCmd);
  }

  /**
   * Center align text (ESC a n)
   */
  static setAlignment(align: "left" | "center" | "right"): Uint8Array {
    const alignMap = { left: 0, center: 1, right: 2 };
    return new Uint8Array([ESC, 0x61, alignMap[align]]);
  }

  /**
   * Convert text to bytes
   */
  static text(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  /**
   * Combine multiple commands into one byte array
   */
  static combine(...commands: Uint8Array[]): Uint8Array {
    const totalLength = commands.reduce((sum, cmd) => sum + cmd.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const cmd of commands) {
      combined.set(cmd, offset);
      offset += cmd.length;
    }
    return combined;
  }
}

/**
 * Printer Connection Interface
 * This interface should be implemented by platform-specific printer drivers
 */
export interface PrinterConnection {
  /**
   * Initialize the printer connection
   */
  init(): Promise<void>;

  /**
   * Get list of available printers
   */
  getDeviceList(): Promise<PrinterDevice[]>;

  /**
   * Connect to a printer
   */
  connect(device: PrinterDevice): Promise<void>;

  /**
   * Disconnect from printer
   */
  disconnect(): Promise<void>;

  /**
   * Check if printer is connected
   */
  isConnected(): boolean;

  /**
   * Send raw data to printer
   */
  sendData(data: Uint8Array): Promise<void>;

  /**
   * Request printer status
   */
  getStatus(): Promise<PrinterStatus>;
}

export interface PrinterDevice {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  address?: string; // For network printers
  type: "usb" | "bluetooth" | "network";
}

export interface PrinterStatus {
  online: boolean;
  paperPresent: boolean;
  coverOpen: boolean;
  error: boolean;
  drawerOpen?: boolean;
}

/**
 * WebUSB Printer Connection
 * Uses the browser's WebUSB API for direct USB communication - no server required.
 * Works with Chrome/Edge on desktop. Requires HTTPS or localhost.
 */
declare global {
  interface Navigator {
    usb?: {
      requestDevice(options: {
        filters?: Array<{ vendorId?: number; productId?: number; classCode?: number }>;
      }): Promise<USBDevice>;
      getDevices(): Promise<USBDevice[]>;
    };
  }
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  opened: boolean;
  configuration?: USBConfiguration | null;
  configurations: USBConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
}

interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
  alternates: USBAlternateInterface[];
}

interface USBAlternateInterface {
  alternateSetting: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: USBEndpoint[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
  packetSize: number;
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}

// Common USB Printer Vendor IDs (thermal/receipt printers)
const USB_PRINTER_FILTERS = [
  { classCode: 7 }, // Printer class
  { vendorId: 0x0483 }, // STMicroelectronics (80-V-LL, many Chinese printers)
  { vendorId: 0x04b8 }, // EPSON
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x0dd4 }, // Custom Engineering
  { vendorId: 0x154f }, // SNBC
  { vendorId: 0x0fe6 }, // Blueprint/ICS Advent (BP-LITE80D1, Datecs)
  { vendorId: 0x20d1 }, // HOIN/Xprinter
  { vendorId: 0x0416 }, // Winbond (some Chinese printers)
  { vendorId: 0x1fc9 }, // NXP (some Chinese printers)
  { vendorId: 0x6868 }, // Generic POS printer
  { vendorId: 0x1504 }, // Face (some thermal printers)
  { vendorId: 0x0525 }, // Netchip (USB gadget mode printers)
];

class WebUSBPrinterConnection implements PrinterConnection {
  private connected: boolean = false;
  public currentDevice: PrinterDevice | null = null;
  private usbDevice: USBDevice | null = null;
  private outEndpoint: number = 1; // Default bulk OUT endpoint
  private interfaceNumber: number = 0;

  async init(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.usb) {
      throw new Error(
        "WebUSB is not available. Use Chrome or Edge browser with HTTPS or localhost. " +
        "Safari and Firefox do not support WebUSB."
      );
    }
    console.log("[Printer] WebUSB ready");
  }

  async getDeviceList(): Promise<PrinterDevice[]> {
    if (typeof navigator === "undefined" || !navigator.usb) {
      throw new Error("WebUSB is not available in this browser.");
    }

    try {
      // Request device from user (shows browser picker dialog)
      const device = await navigator.usb.requestDevice({
        filters: USB_PRINTER_FILTERS,
      });

      this.usbDevice = device;

      return [
        {
          id: `${device.vendorId}:${device.productId}`,
          name: device.productName || device.manufacturerName || "USB Thermal Printer",
          vendorId: device.vendorId,
          productId: device.productId,
          type: "usb" as const,
        },
      ];
    } catch (error: any) {
      if (error.name === "NotFoundError") {
        throw new Error("No USB printer selected. Please select a printer from the dialog.");
      }
      throw new Error(`Failed to access USB printer: ${error.message}`);
    }
  }

  async connect(device: PrinterDevice): Promise<void> {
    if (!this.usbDevice) {
      throw new Error("Please scan for USB printers first.");
    }

    console.log("[Printer] Connecting to USB device:", device.name);

    try {
      // Open the device
      if (!this.usbDevice.opened) {
        await this.usbDevice.open();
      }

      // Select configuration (usually the first one)
      if (this.usbDevice.configuration === null) {
        await this.usbDevice.selectConfiguration(1);
      }

      // Find the printer interface and bulk OUT endpoint
      const configuration = this.usbDevice.configuration;
      if (!configuration) {
        throw new Error("No USB configuration available");
      }

      let foundInterface = false;
      for (const iface of configuration.interfaces) {
        const alternate = iface.alternate;
        
        // Look for printer class (7) or bulk endpoints
        for (const endpoint of alternate.endpoints) {
          if (endpoint.direction === "out" && endpoint.type === "bulk") {
            this.interfaceNumber = iface.interfaceNumber;
            this.outEndpoint = endpoint.endpointNumber;
            foundInterface = true;
            break;
          }
        }
        if (foundInterface) break;
      }

      if (!foundInterface) {
        // Try default values
        console.warn("[Printer] Could not find bulk OUT endpoint, using defaults");
        this.interfaceNumber = 0;
        this.outEndpoint = 1;
      }

      // Claim the interface
      await this.usbDevice.claimInterface(this.interfaceNumber);

      this.currentDevice = device;
      this.connected = true;
      console.log(`[Printer] WebUSB connected - Interface: ${this.interfaceNumber}, Endpoint: ${this.outEndpoint}`);
    } catch (error: any) {
      console.error("[Printer] WebUSB connection error:", error);
      this.connected = false;
      this.currentDevice = null;
      
      const errorMessage = error?.message || String(error);
      const errorName = error?.name || "";
      
      // Check for SecurityError or "Access denied" - common when OS printer driver claims the device
      if (
        errorName === "SecurityError" ||
        errorMessage.includes("Access denied") ||
        errorMessage.includes("access denied") ||
        errorMessage.includes("Access Denied") ||
        errorMessage.includes("Failed to execute 'open' on 'USBDevice'")
      ) {
        // Detect platform for more specific guidance
        const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
        const isWindows = userAgent.includes("win");
        const isMac = userAgent.includes("mac");
        const platformHint = isWindows 
          ? "Windows: Settings > Devices > Printers & scanners" 
          : isMac 
          ? "macOS: System Preferences > Printers & Scanners"
          : "Your OS printer settings";
        
        throw new Error(
          "USB Access Denied: The operating system's printer driver has claimed this device, preventing WebUSB access.\n\n" +
          "Recommended Solutions:\n" +
          "1. Switch to Bluetooth (your printer supports BLE - works better with web browsers)\n" +
          "2. Remove printer from OS settings:\n" +
          `   • ${platformHint}\n` +
          "3. Unplug printer, wait 5 seconds, then plug back in\n\n" +
          "Note: Bluetooth is recommended for web browsers as it doesn't conflict with OS printer drivers."
        );
      }
      
      if (errorMessage.includes("interface") || errorMessage.includes("claim")) {
        throw new Error(
          "Could not claim USB interface. The printer may be in use by another application. " +
          "Try unplugging and reconnecting the printer, or switch to Bluetooth instead."
        );
      }
      throw new Error(`Failed to connect to USB printer: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    console.log("[Printer] Disconnecting WebUSB...");
    try {
      if (this.usbDevice && this.usbDevice.opened) {
        try {
          await this.usbDevice.releaseInterface(this.interfaceNumber);
        } catch (e) {
          // Ignore release errors
        }
        await this.usbDevice.close();
      }
    } catch (error) {
      console.warn("[Printer] Error during USB disconnect:", error);
    }
    this.usbDevice = null;
    this.currentDevice = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.usbDevice !== null && this.usbDevice.opened;
  }

  async sendData(data: Uint8Array): Promise<void> {
    if (!this.usbDevice || !this.connected) {
      throw new Error("USB printer not connected");
    }

    console.log("[Printer] Sending", data.length, "bytes via WebUSB");

    try {
      // Send data in chunks (USB has packet size limits)
      const CHUNK_SIZE = 64; // Common USB packet size
      
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, Math.min(i + CHUNK_SIZE, data.length));
        const result = await this.usbDevice.transferOut(this.outEndpoint, chunk);
        
        if (result.status !== "ok") {
          throw new Error(`USB transfer failed with status: ${result.status}`);
        }
      }
      
      console.log("[Printer] Data sent successfully via WebUSB");
    } catch (error: any) {
      console.error("[Printer] WebUSB send error:", error);
      
      // Check if device disconnected
      if (!this.usbDevice.opened) {
        this.connected = false;
        this.currentDevice = null;
        throw new Error("USB printer disconnected. Please reconnect.");
      }
      
      throw new Error(`Failed to send data to USB printer: ${error.message}`);
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      online: this.isConnected(),
      paperPresent: true,
      coverOpen: false,
      error: false,
    };
  }
}

/**
 * Local Server Printer Connection (Legacy/Fallback)
 * Communicates with a local Node.js server running on the MacBook
 * The server bridges the web app and USB printer
 * NOTE: WebUSB is preferred - use this only if WebUSB doesn't work
 */
class LocalServerPrinterConnection implements PrinterConnection {
  private connected: boolean = false;
  private currentDevice: PrinterDevice | null = null;
  private serverUrl: string;

  constructor(serverUrl: string = "http://localhost:3001") {
    this.serverUrl = serverUrl;
  }

  async init(): Promise<void> {
    console.log("[Printer] Initializing connection to local server...");
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      if (!response.ok) {
        throw new Error("Printer server is not responding");
      }
      console.log("[Printer] Server connection verified");
    } catch (error: any) {
      const hint =
        typeof window !== "undefined" && window.location?.protocol === "https:"
          ? " If you opened the app from a website (HTTPS), use the app from this computer instead: run 'npm run web' and open http://localhost:8081. "
          : "";
      throw new Error(
        `Cannot connect to printer server at ${this.serverUrl}. ` +
          `Make sure the printer server is running on this computer: npm run printer-server (or: node services/printer-server.js). ` +
          `Connect your 80-V-LL (or thermal) printer via USB first.${hint}`
      );
    }
  }

  async getDeviceList(): Promise<PrinterDevice[]> {
    console.log("[Printer] Getting device list from server...");
    try {
      const response = await fetch(`${this.serverUrl}/printers`);
      if (!response.ok) {
        throw new Error("Failed to get printer list");
      }
      const data = await response.json();
      const printers: PrinterDevice[] = (data.printers || []).map((p: any) => ({
        id: p.name,
        name: p.name,
        type: "usb" as const,
      }));
      console.log("[Printer] Found printers:", printers);
      return printers;
    } catch (error: any) {
      console.error("[Printer] Error getting device list:", error);
      const hint =
        this.serverUrl.includes("localhost") &&
        typeof window !== "undefined" &&
        window.location?.hostname !== "localhost"
          ? " Run the app from this computer (npm run web, open http://localhost:8081) and start the printer server (npm run printer-server)."
          : "";
      throw new Error(
        `Failed to get printer list: ${error.message}.${hint}`
      );
    }
  }

  async connect(device: PrinterDevice): Promise<void> {
    console.log("[Printer] Connecting to device:", device.name);
    this.currentDevice = device;
    this.connected = true;
    // For local server, connection is implicit - we just store the device
  }

  async disconnect(): Promise<void> {
    console.log("[Printer] Disconnecting...");
    this.currentDevice = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendData(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error("Printer not connected");
    }
    console.log("[Printer] Sending data to server:", data.length, "bytes");

    try {
      const response = await fetch(`${this.serverUrl}/print`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commands: Array.from(data),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send print command");
      }

      const result = await response.json();
      console.log("[Printer] Print command sent successfully:", result);
    } catch (error: any) {
      console.error("[Printer] Error sending data:", error);
      throw new Error(`Failed to send print command: ${error.message}`);
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.connected) {
      throw new Error("Printer not connected");
    }
    // For now, assume printer is online if we can connect to server
    // In the future, we could add a status endpoint to the server
    return {
      online: true,
      paperPresent: true,
      coverOpen: false,
      error: false,
    };
  }
}

/**
 * Web Bluetooth Printer Connection (BLE)
 * Uses the browser's Web Bluetooth API - no printer server required.
 * Works with BLE-capable thermal printers (some 80-V-LL / BT 4.0 printers support BLE).
 */
type WebBluetoothDevice = {
  id: string;
  name?: string;
  gatt?: { connect(): Promise<WebBluetoothGATTServer> };
};
type WebBluetoothGATTServer = {
  connected: boolean;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{
    getCharacteristics(): Promise<WebBluetoothCharacteristic[]>;
  }>;
};
type WebBluetoothCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithResponse?(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
};
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>;
        acceptAllDevices?: boolean;
        optionalServices?: string[];
      }): Promise<WebBluetoothDevice>;
    };
  }
}

const BLE_PRINTER_SERVICES = [
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Common BLE printer service
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "00001101-0000-1000-8000-00805f9b34fb", // Serial Port
];

class WebBluetoothPrinterConnection implements PrinterConnection {
  private connected: boolean = false;
  public currentDevice: PrinterDevice | null = null;
  private gattServer: WebBluetoothGATTServer | null = null;
  private writeCharacteristic: WebBluetoothCharacteristic | null = null;
  private pendingDevice: WebBluetoothDevice | null = null;

  async init(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      throw new Error(
        "Web Bluetooth is not available. Use Chrome, Edge, or a browser that supports Web Bluetooth (and HTTPS or localhost)."
      );
    }
    console.log("[Printer] Web Bluetooth ready");
  }

  async getDeviceList(): Promise<PrinterDevice[]> {
    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser.");
    }
    const device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICES,
    } as { acceptAllDevices: boolean; optionalServices: string[] });
    this.pendingDevice = device;
    return [
      {
        id: device.id,
        name: device.name || "Bluetooth Printer",
        address: device.id,
        type: "bluetooth" as const,
      },
    ];
  }

  async connect(device: PrinterDevice): Promise<void> {
    const bleDevice = this.pendingDevice;
    if (!bleDevice || bleDevice.id !== device.id) {
      throw new Error("Please scan for Bluetooth printers again and select your printer.");
    }
    console.log("[Printer] Connecting to BLE device:", device.name);
    const server = await bleDevice.gatt!.connect();
    this.gattServer = server;
    for (const serviceUuid of BLE_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.writeWithoutResponse || char.properties.write) {
            this.writeCharacteristic = char;
            break;
          }
        }
        if (this.writeCharacteristic) break;
      } catch {
        continue;
      }
    }
    if (!this.writeCharacteristic) {
      this.gattServer.disconnect();
      this.gattServer = null;
      throw new Error("Could not find a writable characteristic on this BLE device. It may not be a BLE printer.");
    }
    this.currentDevice = device;
    this.connected = true;
    this.pendingDevice = null;
    console.log("[Printer] Web Bluetooth connected");
  }

  async disconnect(): Promise<void> {
    if (this.gattServer?.connected) {
      this.gattServer.disconnect();
    }
    this.gattServer = null;
    this.writeCharacteristic = null;
    this.currentDevice = null;
    this.connected = false;
    this.pendingDevice = null;
  }

  isConnected(): boolean {
    return this.connected && this.gattServer?.connected === true;
  }

  async sendData(data: Uint8Array): Promise<void> {
    if (!this.writeCharacteristic) throw new Error("Printer not connected");
    // BLE GATT has limited MTU (often 20–185 bytes). Sending large chunks causes
    // "GATT operation failed for unknown reason." Use small chunks and delay between writes.
    const BLE_CHUNK_SIZE = 20;
    const BLE_DELAY_MS = 25;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const char = this.writeCharacteristic;
    const useWithoutResponse =
      char.properties.writeWithoutResponse &&
      typeof (char as WebBluetoothCharacteristic).writeValueWithoutResponse === "function";

    for (let i = 0; i < data.length; i += BLE_CHUNK_SIZE) {
      const chunk = data.slice(i, i + BLE_CHUNK_SIZE);
      try {
        if (useWithoutResponse) {
          await (char as WebBluetoothCharacteristic).writeValueWithoutResponse!(chunk);
        } else {
          await char.writeValue(chunk);
        }
      } catch (e) {
        throw new Error(
          `GATT write failed at offset ${i}/${data.length}. BLE may need smaller chunks or the connection was lost: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      await delay(BLE_DELAY_MS);
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    return {
      online: this.isConnected(),
      paperPresent: true,
      coverOpen: false,
      error: false,
    };
  }
}

/**
 * Bluetooth Printer Connection (native Android/iOS)
 * Handles Bluetooth thermal printer communication via react-native-thermal-pos-printer
 */
class BluetoothPrinterConnection implements PrinterConnection {
  private connected: boolean = false;
  public currentDevice: PrinterDevice | null = null;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    console.log("[Printer] Initializing Bluetooth connection...");
    
    // On web, use Web Bluetooth instead (handled by createPrinterService)
    if (Platform.OS === "web") {
      const errorMsg = "Bluetooth printers are not supported on web browsers. Please use the native mobile app (Android/iOS) to connect to Bluetooth printers, or switch to USB printer type for web usage.";
      console.warn("[Printer]", errorMsg);
      throw new Error(errorMsg);
    }

    // Try to get the library at runtime
    const ReactNativePosPrinter = getReactNativePosPrinter();
    if (!ReactNativePosPrinter) {
      const availableModules = Object.keys(NativeModules).join(", ");
      throw new Error(
        `Bluetooth printer library not available. ` +
        `Please ensure react-native-thermal-pos-printer is installed and the app is rebuilt with native code. ` +
        `Run: npx expo prebuild --clean && npx expo run:android (or run:ios). ` +
        `Available NativeModules: ${availableModules || "none"}`
      );
    }

    try {
      // Initialize the printer library
      // The error "expected argument count: 1" suggests init() needs a callback
      // Some versions don't require init() at all, so we'll try but not fail if it errors
      if (ReactNativePosPrinter.init) {
        try {
          // Try with callback function (most React Native modules use this pattern)
          await new Promise<void>((resolve, reject) => {
            // Wrap in try-catch in case it's synchronous
            try {
              const result = ReactNativePosPrinter.init((error: any) => {
                if (error) {
                  console.warn("[Printer] init() callback returned error:", error);
                  // Don't reject - some versions return errors but still work
                  resolve();
                } else {
                  resolve();
                }
              });
              
              // If init returns a promise, wait for it
              if (result && typeof result.then === 'function') {
                result.then(resolve).catch((err: any) => {
                  console.warn("[Printer] init() promise rejected, continuing:", err);
                  resolve(); // Continue anyway
                });
              }
            } catch (syncError: any) {
              // If synchronous call fails, try promise-based
              if (typeof ReactNativePosPrinter.init === 'function') {
                const promiseResult = ReactNativePosPrinter.init({});
                if (promiseResult && typeof promiseResult.then === 'function') {
                  promiseResult.then(resolve).catch(() => resolve());
                } else {
                  resolve(); // Assume it worked
                }
              } else {
                resolve(); // No init needed
              }
            }
          });
          console.log("[Printer] init() completed");
        } catch (initError: any) {
          // If init fails completely, log but continue
          // Many versions of the library don't require explicit init()
          console.warn("[Printer] init() failed, but continuing (may not be required):", initError.message);
        }
      }
      
      this.isInitialized = true;
      console.log("[Printer] Bluetooth printer library ready");
      
      // Try to auto-connect to saved device if available
      await this.autoConnect();
    } catch (error: any) {
      console.error("[Printer] Error initializing Bluetooth:", error);
      // If error is about init(), continue anyway as it may not be required
      if (error.message && error.message.includes("init")) {
        console.warn("[Printer] Continuing despite init() error - some versions don't require it");
        this.isInitialized = true;
        // Still try auto-connect
        try {
          await this.autoConnect();
        } catch (connectError) {
          // Auto-connect failure is okay
          console.warn("[Printer] Auto-connect failed:", connectError);
        }
      } else {
        throw new Error(`Failed to initialize Bluetooth: ${error.message}`);
      }
    }
  }

  /**
   * Auto-connect to saved Bluetooth device if available
   */
  private async autoConnect(): Promise<void> {
    try {
      const { getPrinterType, getBluetoothDevice } = await import('./printer-settings');
      const printerType = await getPrinterType();
      const savedDevice = await getBluetoothDevice();
      
      if (printerType === 'bluetooth' && savedDevice && savedDevice.address) {
        console.log("[Printer] Attempting to auto-connect to saved device:", savedDevice.name);
        try {
          await this.connect({
            id: savedDevice.id,
            name: savedDevice.name,
            address: savedDevice.address,
            type: 'bluetooth'
          });
          console.log("[Printer] Auto-connected to saved Bluetooth device");
        } catch (error) {
          console.warn("[Printer] Auto-connect failed, user will need to reconnect:", error);
        }
      }
    } catch (error) {
      console.warn("[Printer] Error during auto-connect:", error);
    }
  }

  async getDeviceList(): Promise<PrinterDevice[]> {
    console.log("[Printer] Getting Bluetooth device list...");
    try {
      // Check if we're on web
      if (Platform.OS === "web") {
        const errorMsg = "Bluetooth printers are not supported on web browsers. Please use the native mobile app (Android/iOS) to connect to Bluetooth printers.";
        console.warn("[Printer]", errorMsg);
        throw new Error(errorMsg);
      }

      // Ensure initialized
      if (!this.isInitialized) {
        await this.init();
      }

      // Try to get the library at runtime
      const ReactNativePosPrinter = getReactNativePosPrinter();
      if (!ReactNativePosPrinter) {
        const availableModules = Object.keys(NativeModules).join(", ");
        throw new Error(
          `Bluetooth printer library not available. ` +
          `Please ensure react-native-thermal-pos-printer is installed and the app is rebuilt with native code. ` +
          `Run: npx expo prebuild --clean && npx expo run:android (or run:ios). ` +
          `Available NativeModules: ${availableModules || "none"}`
        );
      }

      // Get list of available devices (both paired and discovered)
      const devices = await ReactNativePosPrinter.getDeviceList();
      
      console.log("[Printer] Found devices:", devices);
      
      // Map to PrinterDevice format
      const printerDevices: PrinterDevice[] = devices.map((device: any) => {
        // Device format from react-native-thermal-pos-printer
        // Usually has: id, name, address, type
        return {
          id: device.id || device.address || device.macAddress || `bt-${device.name}`,
          name: device.name || device.deviceName || 'Unknown Printer',
          address: device.address || device.macAddress || device.id,
          type: 'bluetooth' as const,
        };
      });

      // Filter for printers (look for common printer names or all if none match)
      const filteredDevices = printerDevices.filter((device) => {
        const name = device.name.toLowerCase();
        return (
          name.includes('printer') ||
          name.includes('lite') ||
          name.includes('80') ||
          name.includes('d1') ||
          name.includes('pos') ||
          name.includes('thermal') ||
          printerDevices.length === 0 // If no devices found, return all
        );
      });

      // If filtered list is empty but we have devices, return all devices
      const result = filteredDevices.length > 0 ? filteredDevices : printerDevices;
      
      console.log("[Printer] Returning Bluetooth devices:", result);
      return result;
    } catch (error: any) {
      console.error("[Printer] Error getting Bluetooth device list:", error);
      throw new Error(`Failed to get Bluetooth device list: ${error.message}`);
    }
  }

  async connect(device: PrinterDevice): Promise<void> {
    console.log("[Printer] Connecting to Bluetooth device:", device.name);
    try {
      // Check if we're on web
      if (Platform.OS === "web") {
        throw new Error("Bluetooth is not supported on web");
      }

      // Ensure initialized
      if (!this.isInitialized) {
        await this.init();
      }

      // Try to get the library at runtime
      const ReactNativePosPrinter = getReactNativePosPrinter();
      if (!ReactNativePosPrinter) {
        const availableModules = Object.keys(NativeModules).join(", ");
        throw new Error(
          `Bluetooth printer library not available. ` +
          `Please ensure react-native-thermal-pos-printer is installed and the app is rebuilt with native code. ` +
          `Available NativeModules: ${availableModules || "none"}`
        );
      }

      // Disconnect current device if connected
      if (this.connected && this.currentDevice) {
        try {
          await this.disconnect();
        } catch (error) {
          console.warn("[Printer] Error disconnecting previous device:", error);
        }
      }

      // Get device address (required for connection)
      const deviceAddress = device.address || device.id;
      if (!deviceAddress) {
        throw new Error("Device address is required for Bluetooth connection");
      }

      console.log("[Printer] Connecting to device address:", deviceAddress);

      // Connect to the printer via Bluetooth
      await ReactNativePosPrinter.connectPrinter(deviceAddress, 'BLUETOOTH');

      // Store connected device
      this.currentDevice = device;
      this.connected = true;

      // Save device preference
      try {
        const { setBluetoothDevice } = await import('./printer-settings');
        await setBluetoothDevice({
          id: device.id,
          name: device.name,
          address: deviceAddress,
        });
      } catch (error) {
        console.warn("[Printer] Failed to save device preference:", error);
      }

      console.log("[Printer] Bluetooth device connected successfully:", device.name);
    } catch (error: any) {
      console.error("[Printer] Error connecting to Bluetooth device:", error);
      this.connected = false;
      this.currentDevice = null;
      throw new Error(`Failed to connect to Bluetooth device: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    console.log("[Printer] Disconnecting Bluetooth device...");
    try {
      const ReactNativePosPrinter = getReactNativePosPrinter();
      if (this.connected && ReactNativePosPrinter) {
        try {
          // Disconnect from printer
          await ReactNativePosPrinter.disconnectPrinter();
        } catch (error) {
          console.warn("[Printer] Error during library disconnect:", error);
        }
      }
      
      this.currentDevice = null;
      this.connected = false;
      console.log("[Printer] Bluetooth device disconnected");
    } catch (error: any) {
      console.error("[Printer] Error disconnecting Bluetooth device:", error);
      // Still reset connection state even if disconnect fails
      this.currentDevice = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendData(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error("Bluetooth printer not connected");
    }

    // Try to get the library at runtime
    const ReactNativePosPrinter = getReactNativePosPrinter();
    if (!ReactNativePosPrinter) {
      const availableModules = Object.keys(NativeModules).join(", ");
      throw new Error(
        `Bluetooth printer library not available. ` +
        `Please ensure react-native-thermal-pos-printer is installed and the app is rebuilt with native code. ` +
        `Available NativeModules: ${availableModules || "none"}`
      );
    }

    console.log("[Printer] Sending data to Bluetooth printer:", data.length, "bytes");
    try {
      // Convert Uint8Array to array of numbers (0-255) for native module
      const dataArray = Array.from(data);
      
      // react-native-thermal-pos-printer native module (PosPrinter) exposes sendRawCommand(command: ReadableArray)
      // Try sendRawCommand first (this is what the Android/iOS native module provides)
      if (typeof ReactNativePosPrinter.sendRawCommand === "function") {
        await ReactNativePosPrinter.sendRawCommand(dataArray);
        console.log("[Printer] Data sent via sendRawCommand");
        return;
      }
      
      // Fallbacks for other library variants
      if (ReactNativePosPrinter.printRawData) {
        await ReactNativePosPrinter.printRawData(dataArray);
        console.log("[Printer] Data sent via printRawData");
        return;
      }
      if (ReactNativePosPrinter.sendRawData) {
        await ReactNativePosPrinter.sendRawData(dataArray);
        console.log("[Printer] Data sent via sendRawData");
        return;
      }
      if (ReactNativePosPrinter.printBytes) {
        await ReactNativePosPrinter.printBytes(dataArray);
        console.log("[Printer] Data sent via printBytes");
        return;
      }
      if (ReactNativePosPrinter.printBase64) {
        let base64String = "";
        for (let i = 0; i < data.length; i++) {
          base64String += String.fromCharCode(data[i]);
        }
        const base64 = btoa(base64String);
        await ReactNativePosPrinter.printBase64(base64);
        console.log("[Printer] Data sent via printBase64");
        return;
      }
      
      throw new Error(
        "Library does not support raw byte printing. " +
        "Available methods: " + Object.keys(ReactNativePosPrinter).join(", ") +
        ". Please check library documentation or update the implementation."
      );
    } catch (error: any) {
      console.error("[Printer] Error sending data to Bluetooth printer:", error);
      throw new Error(`Failed to send data to Bluetooth printer: ${error.message}`);
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.connected) {
      throw new Error("Bluetooth printer not connected");
    }
    // Placeholder for Bluetooth status check
    return {
      online: true,
      paperPresent: true,
      coverOpen: false,
      error: false,
    };
  }
}

/**
 * Default Printer Connection (USB/Placeholder)
 * This is a placeholder that logs commands.
 * For actual implementation, you'll need to:
 * 1. Install a library like react-native-thermal-receipt-printer (Android only)
 * 2. Create a native module for iOS USB support
 * 3. Use network printing if printer supports it
 */
class DefaultPrinterConnection implements PrinterConnection {
  private connected: boolean = false;
  private currentDevice: PrinterDevice | null = null;

  async init(): Promise<void> {
    console.log("[Printer] Initializing USB connection...");
    // Platform-specific initialization would go here
  }

  async getDeviceList(): Promise<PrinterDevice[]> {
    console.log("[Printer] Getting USB device list...");
    // Platform-specific device discovery would go here
    // For now, return empty array - implement based on your platform
    return [];
  }

  async connect(device: PrinterDevice): Promise<void> {
    console.log("[Printer] Connecting to USB device:", device.name);
    this.currentDevice = device;
    this.connected = true;
    // Platform-specific connection would go here
  }

  async disconnect(): Promise<void> {
    console.log("[Printer] Disconnecting USB device...");
    this.currentDevice = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendData(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error("USB printer not connected");
    }
    console.log("[Printer] Sending data to USB printer:", data.length, "bytes");
    console.log(
      "[Printer] Data (hex):",
      Array.from(data)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
    );
    // Platform-specific data sending would go here
    // For USB on iPad, you'd need a native module or library
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.connected) {
      throw new Error("USB printer not connected");
    }
    // Platform-specific status request would go here
    return {
      online: true,
      paperPresent: true,
      coverOpen: false,
      error: false,
    };
  }
}

/**
 * Thermal Printer Service
 * Main service for interacting with thermal printers
 */
class ThermalPrinterService {
  private connection: PrinterConnection;
  private isInitialized: boolean = false;

  constructor(connection?: PrinterConnection) {
    this.connection = connection || new DefaultPrinterConnection();
  }

  /**
   * Initialize the printer service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.connection.init();
    this.isInitialized = true;
  }

  /**
   * Get list of available printers
   */
  async getAvailablePrinters(): Promise<PrinterDevice[]> {
    await this.initialize();
    return await this.connection.getDeviceList();
  }

  /**
   * Connect to a printer
   */
  async connect(device: PrinterDevice): Promise<void> {
    await this.initialize();
    await this.connection.connect(device);
    // Initialize printer after connection
    const initCmd = ESCPOSCommands.initialize();
    await this.connection.sendData(initCmd);
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.connection.isConnected()) {
      await this.connection.disconnect();
    }
  }

  /**
   * Get current connected device info
   */
  getConnectedDevice(): PrinterDevice | null {
    if (this.connection.isConnected() && 'currentDevice' in this.connection) {
      return (this.connection as any).currentDevice || null;
    }
    return null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; device: PrinterDevice | null } {
    return {
      connected: this.connection.isConnected(),
      device: this.getConnectedDevice(),
    };
  }

  /**
   * Test printer connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.initialize();

      const { getPrinterType, getBluetoothDevice } = await import('./printer-settings');
      const printerType = await getPrinterType();
      const savedDevice = await getBluetoothDevice();

      // If Bluetooth and we have a saved device, connect to it directly (no scan needed)
      if (printerType === "bluetooth" && savedDevice && (savedDevice.id || savedDevice.address)) {
        try {
          await this.connect({
            id: savedDevice.id || savedDevice.address || "",
            name: savedDevice.name || "Bluetooth Printer",
            address: savedDevice.address || savedDevice.id,
            type: "bluetooth",
          });
          await this.connection.getStatus();
          console.log("[Printer] Reconnected to saved Bluetooth device:", savedDevice.name);
          return true;
        } catch (savedConnectError) {
          console.warn("[Printer] Reconnect to saved device failed, falling back to scan:", savedConnectError);
        }
      }

      const devices = await this.connection.getDeviceList();

      if (devices.length === 0) {
        const connectionMethod =
          printerType === "bluetooth" ? "paired and turned on" : "connected via USB";
        throw new Error(
          `No ${printerType.toLowerCase()} printers found. Please ensure the printer is ${connectionMethod}.`
        );
      }

      await this.connect(devices[0]);

      // Request status to verify connection
      await this.connection.getStatus();

      return true;
    } catch (error) {
      console.error("Printer connection test failed:", error);
      throw error;
    }
  }

  /**
   * Print test receipt
   */
  async printTestReceipt(): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Please test connection first.");
    }

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text("TEST RECEIPT\n"),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.selectPrintMode({}), // Reset to normal
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text("Printer Connection Test\n"),
      ESCPOSCommands.text("Date: " + getCurrentDateTimeIndo() + "\n"),
      ESCPOSCommands.lineFeed(2),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text("----------------\n"),
      ESCPOSCommands.text("If you can read this,\n"),
      ESCPOSCommands.text("your printer is working!\n"),
      ESCPOSCommands.text("----------------\n"),
      ESCPOSCommands.lineFeed(3),
      ESCPOSCommands.cutPaper(0) // Full cut
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print billiard table start receipt:
   * - Big table number in the middle
   * - Start and end time below
   */
  async printBilliardStartReceipt(data: BilliardStartReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Please test connection first.");
    }

    const start = new Date(data.startAt);
    const end = new Date(data.endAt);

    const formatTime = (d: Date): string =>
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text(`MEJA ${data.tableNumber}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.lineFeed(1),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text(
        `Mulai dari ${formatTime(start)} sampai ${formatTime(end)}\n`
      ),
      ESCPOSCommands.lineFeed(3),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print billiard payment receipt for TigaSekawan.
   */
  async printBilliardPaymentReceipt(data: BilliardPaymentReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Please test connection first.");
    }

    const start = new Date(data.startAt);
    const end = new Date(data.endAt);

    const formatDateTime = (d: Date): string =>
      new Intl.DateTimeFormat(["ban", "id"], {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);

    const formatIDR = (amount: number): string => {
      const integerAmount = Math.round(amount);
      return integerAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
    const formatHours = (hours: number): string =>
      Number.isInteger(hours) ? String(hours) : String(hours);

    const fullWidthDottedLine = "................................................\n";
    const pricingBreakdown = data.pricingBreakdown ?? [];
    const hasRateDifference =
      pricingBreakdown.length > 1 &&
      new Set(pricingBreakdown.map((item) => item.ratePerHour)).size > 1;

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text("TIGA SEKAWAN\n"),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("BILLIARD RECEIPT\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.lineFeed(1),

      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.text(`Meja       : ${data.tableNumber}\n`),
      ESCPOSCommands.text(`Kasir      : ${data.cashierName}\n`),
      ESCPOSCommands.text(`Mulai      : ${formatDateTime(start)}\n`),
      ESCPOSCommands.text(`Selesai    : ${formatDateTime(end)}\n`),
      ESCPOSCommands.text(fullWidthDottedLine),

      ESCPOSCommands.text(`Durasi     : ${data.hours} jam\n`),
      ...(hasRateDifference
        ? [
            ESCPOSCommands.text("Rincian    :\n"),
            ...pricingBreakdown.flatMap((item) => [
              ESCPOSCommands.text(
                `  ${formatHours(item.hours)} jam x Rp ${formatIDR(
                  item.ratePerHour
                )} = Rp ${formatIDR(item.amount)}\n`
              ),
            ]),
            ESCPOSCommands.text(`Subtotal   : Rp ${formatIDR(data.totalAmount)}\n`),
          ]
        : [
            ESCPOSCommands.text(
              `Subtotal   : ${data.hours} x Rp ${formatIDR(
                data.ratePerHour
              )} = Rp ${formatIDR(data.totalAmount)}\n`
            ),
          ]),
      ESCPOSCommands.text(fullWidthDottedLine),

      ESCPOSCommands.text(`Metode Bayar: ${data.paymentMethod}\n`),
      ...(data.paymentMethod.toLowerCase() === "cash" && typeof data.cashReceived === "number"
        ? [
            ESCPOSCommands.text(
              `Tunai      : Rp ${formatIDR(data.cashReceived)}\n`
            ),
            ESCPOSCommands.text(
              `Kembalian  : Rp ${formatIDR(
                typeof data.changeAmount === "number"
                  ? data.changeAmount
                  : Math.max(0, data.cashReceived - data.totalAmount)
              )}\n`
            ),
          ]
        : []),
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text(`TOTAL Rp ${formatIDR(data.totalAmount)}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.text("Terima kasih!\n"),
      ESCPOSCommands.lineFeed(2),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print text
   */
  async printText(
    text: string,
    options?: {
      align?: "left" | "center" | "right";
      emphasized?: boolean;
      doubleHeight?: boolean;
      doubleWidth?: boolean;
    }
  ): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }

    const commands = ESCPOSCommands.combine(
      options?.align ? ESCPOSCommands.setAlignment(options.align) : new Uint8Array(0),
      ESCPOSCommands.selectPrintMode({
        emphasized: options?.emphasized,
        doubleHeight: options?.doubleHeight,
        doubleWidth: options?.doubleWidth,
      }),
      ESCPOSCommands.text(text),
      ESCPOSCommands.selectPrintMode({}), // Reset
      ESCPOSCommands.setAlignment("left") // Reset alignment
    );

    await this.connection.sendData(commands);
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Get printer status
   */
  async getStatus(): Promise<PrinterStatus> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }
    return await this.connection.getStatus();
  }

  /**
   * Print cash sale receipt
   * Uses exact same format as wholesale receipt
   */
  async printCashReceipt(data: ReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }

    const cashReceived =
      data.cashReceived && data.cashReceived > 0 ? data.cashReceived : data.total;
    const change = cashReceived - data.total;

    // Format date like the HTML receipt
    const dateObj = typeof data.date === "string" ? new Date(data.date) : data.date;
    const formattedDate = new Intl.DateTimeFormat(["ban", "id"], {
      year: "numeric",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);

    // Format currency helper
    const formatIDR = (amount: number): string => {
      const integerAmount = Math.round(amount);
      return integerAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    // Full-width dotted line for 80mm printer (48 characters)
    const fullWidthDottedLine = "................................................\n";

    const paymentLabel = data.paymentMethod || "Cash";

    // Format totals lines with proper spacing
    const totalLine = `Total Rp ${formatIDR(data.total)}\n`;
    const paymentLine = `Bayar ${paymentLabel} Rp ${formatIDR(cashReceived)}\n`;
    const kembalianLine =
      data.paymentMethod === "Cash" ? `Kembalian Rp ${formatIDR(change)}\n` : null;

    const commands = ESCPOSCommands.combine(
      // Initialize printer (no blank line at top)
      ESCPOSCommands.initialize(),

      // Belanja Kontan header - Center aligned (no content above)
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("Belanja Kontan\n"),
      ESCPOSCommands.selectPrintMode({}),

      // TOKO EDYSON header - Bigger (no extra space after address)
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text("TOKO EDYSON\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text("Pulau Burung KM.00\n"),
      ESCPOSCommands.text("Indragiri Hilir\n"),

      // Line after TOKO EDYSON - Full width (no extra space before Kasir)
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(fullWidthDottedLine),

      // Cashier and date info - left aligned (no extra space)
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(`Kasir: ${data.cashierName}\n`),
      ESCPOSCommands.text(`Tanggal: ${formattedDate}\n`),

      // Divider - Full width (no extra space before Nama Barang)
      ESCPOSCommands.text(fullWidthDottedLine),

      // Items header
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("Nama Barang                               Total\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(fullWidthDottedLine),

      // Items list
      ...data.items.flatMap((item) => {
        const itemTotal = item.price * item.quantity;
        const itemName = item.barang.barangNama;
        const itemUnit = item.barang.barangUnit;
        const qtyStr = `${item.quantity} ${itemUnit}`;
        const priceStr = `Rp ${formatIDR(item.price)}`;
        const totalStr = `Rp ${formatIDR(itemTotal)}`;

        // Format: Item name on first line, then quantity X price on second line with total on right
        const itemLine = `${qtyStr} X ${priceStr}`;
        // Calculate padding to align total to the right (48 chars width for 80mm printer)
        const itemLineLength = itemLine.length;
        const totalStrLength = totalStr.length;
        const paddingNeeded = 48 - itemLineLength - totalStrLength;
        const padding = paddingNeeded > 0 ? " ".repeat(paddingNeeded) : " ";

        return [
          // Item name on its own line
          ESCPOSCommands.setAlignment("left"),
          ESCPOSCommands.text(`${itemName}\n`),
          // Quantity X Price with total aligned to right (no dotted line between items)
          ESCPOSCommands.text(`${itemLine}${padding}${totalStr}\n`),
        ];
      }),

      // Totals section (no extra space before Total)
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.text(totalLine),
      ESCPOSCommands.selectPrintMode({}),

      // Payment method - Right aligned
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.text(paymentLine),

      // Kembalian (change) - Right aligned (no extra space before)
      ...(kembalianLine
        ? [
            ESCPOSCommands.text(fullWidthDottedLine),
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.setAlignment("right"),
            ESCPOSCommands.text(kembalianLine),
            ESCPOSCommands.selectPrintMode({}),
          ]
        : []),

      // Divider before barcode - Full width (no extra space)
      ESCPOSCommands.text(fullWidthDottedLine),

      // Barcode of receipt number (HRI prints number below barcode)
      ...(data.saleId
        ? [
            ESCPOSCommands.setAlignment("center"),
            ESCPOSCommands.text("Receipt Barcode:\n"),
            ESCPOSCommands.printBarcode(
              data.saleId.toString(),
              73, // CODE128
              50,
              2,
              2 // HRI below
            ),
          ]
        : []),

      // Footer - thank you on one line (no extra space before/after)
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.text("Terima kasih atas kunjungan Anda!\n"),
      ESCPOSCommands.lineFeed(1),

      // Cut paper
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print wholesale sale receipt
   * Compact layout matching cash sales receipt; keeps client name, Setor, and Sisa.
   */
  async printWholesaleReceipt(data: ReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }

    if (!data.invoiceNo) {
      throw new Error("Invoice number is required for wholesale receipts");
    }

    // Format date like the HTML receipt
    const dateObj = typeof data.date === "string" ? new Date(data.date) : data.date;
    const formattedDate = new Intl.DateTimeFormat(["ban", "id"], {
      year: "numeric",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);

    // Format currency helper
    const formatIDR = (amount: number): string => {
      const integerAmount = Math.round(amount);
      return integerAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const sisaBonGrosir = data.sisaBonGrosir || 0;

    // Full-width dotted line for 80mm printer (48 characters) - same as cash receipt
    const fullWidthDottedLine = "................................................\n";

    const commands = ESCPOSCommands.combine(
      // Initialize printer (no blank line at top)
      ESCPOSCommands.initialize(),

      // Grosir header - center, same style as "Belanja Kontan"
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("Nota Grosir\n"),
      ESCPOSCommands.selectPrintMode({}),

      // TOKO EDYSON - same big header as cash receipt
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text("TOKO EDYSON\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text("Pulau Burung KM.00\n"),
      ESCPOSCommands.text("Indragiri Hilir\n"),

      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(fullWidthDottedLine),

      // Client name (keep), Kasir, Tanggal - compact, no extra line feeds
      ESCPOSCommands.text(`Nama Pelanggan: ${data.customerName || ""}\n`),
      ESCPOSCommands.text(`Kasir: ${data.cashierName}\n`),
      ESCPOSCommands.text(`Tanggal: ${formattedDate}\n`),

      ESCPOSCommands.text(fullWidthDottedLine),

      // Items header - same as cash: "Nama Barang" left, "Total" right
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("Nama Barang                               Total\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(fullWidthDottedLine),

      // Items list - same format as cash: name on first line, "qty X price" + total on second
      ...data.items.flatMap((item) => {
        const itemTotal = item.price * item.quantity;
        const itemName = item.barang.barangNama;
        const itemUnit = item.barang.barangUnit;
        const qtyStr = `${item.quantity} ${itemUnit}`;
        const priceStr = `Rp ${formatIDR(item.price)}`;
        const totalStr = `Rp ${formatIDR(itemTotal)}`;
        const itemLine = `${qtyStr} X ${priceStr}`;
        const itemLineLength = itemLine.length;
        const totalStrLength = totalStr.length;
        const paddingNeeded = 48 - itemLineLength - totalStrLength;
        const padding = paddingNeeded > 0 ? " ".repeat(paddingNeeded) : " ";

        return [
          ESCPOSCommands.text(`${itemName}\n`),
          ESCPOSCommands.text(`${itemLine}${padding}${totalStr}\n`),
        ];
      }),

      // Totals section - Total, Setor, Sisa (right-aligned, compact)
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.text(`Total Rp ${formatIDR(data.total)}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(`Setor Rp ${formatIDR(data.setorGrosir || 0)}\n`),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text(`Sisa Rp ${formatIDR(sisaBonGrosir)}\n`),
      ESCPOSCommands.selectPrintMode({}),

      // Divider before barcode - one line, then barcode
      ESCPOSCommands.text(fullWidthDottedLine),
      ...(data.invoiceNo
        ? [
            ESCPOSCommands.setAlignment("center"),
            ESCPOSCommands.text("Invoice Barcode:\n"),
            ESCPOSCommands.printBarcode(
              data.invoiceNo.toString(),
              73,
              50,
              2,
              2
            ),
          ]
        : []),

      // Footer - one line like cash receipt
      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.text("Terima kasih atas kunjungan Anda!\n"),
      ESCPOSCommands.lineFeed(1),

      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print Surat Jalan (delivery note) for grosir sales.
   * Acts as invoice for client and checklist for items delivered.
   * Printed after the normal grosir receipt.
   */
  async printGrosirSuratJalan(data: ReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }

    const dateObj = typeof data.date === "string" ? new Date(data.date) : data.date;
    const formattedDate = new Intl.DateTimeFormat(["ban", "id"], {
      year: "numeric",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);

    const formatIDR = (amount: number): string => {
      const n = Math.round(amount);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const sisaBonGrosir = data.sisaBonGrosir ?? 0;
    const fullWidthDottedLine = "................................................\n";

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),

      // SURAT JALAN - big title
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({
        doubleHeight: true,
        doubleWidth: true,
        emphasized: true,
      }),
      ESCPOSCommands.text("SURAT JALAN\n"),
      ESCPOSCommands.selectPrintMode({}),

      ESCPOSCommands.text("TOKO EDYSON\n"),
      ESCPOSCommands.text("Pulau Burung KM.00\n"),
      ESCPOSCommands.text("Indragiri Hilir\n"),

      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(fullWidthDottedLine),

      ESCPOSCommands.text(`Nama Pelanggan: ${data.customerName ?? ""}\n`),
      ESCPOSCommands.text(`Tanggal: ${formattedDate}\n`),
      ...(data.invoiceNo
        ? [ESCPOSCommands.text(`No. Invoice: #${data.invoiceNo}\n`)]
        : []),
      ESCPOSCommands.text(fullWidthDottedLine),

      // Items list for delivery check: 2 lines per item (name, then qty x price = total)
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("No.  Nama Barang\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(fullWidthDottedLine),

      ...data.items.flatMap((item, index) => {
        const no = (index + 1).toString();
        const name = item.barang.barangNama;
        const nameTrunc = name.length > 40 ? name.slice(0, 37) + "..." : name;
        const itemTotal = item.price * item.quantity;
        const detailLine = `   ${item.quantity} ${item.barang.barangUnit} x Rp ${formatIDR(item.price)} = Rp ${formatIDR(itemTotal)}`;
        return [
          ESCPOSCommands.text(`${no.padEnd(4)}${nameTrunc}\n`),
          ESCPOSCommands.text(`${detailLine}\n`),
        ];
      }),

      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.text(`Total Rp ${formatIDR(data.total)}\n`),
      ESCPOSCommands.text(`Setor Rp ${formatIDR(data.setorGrosir ?? 0)}\n`),
      ESCPOSCommands.text(`Sisa Rp ${formatIDR(sisaBonGrosir)}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.setAlignment("left"),

      ESCPOSCommands.text(fullWidthDottedLine),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text("Barang yang diterima sudah dicek\n"),
      ESCPOSCommands.lineFeed(1),
      ESCPOSCommands.text("Tanda tangan penerima: _______________\n"),
      ESCPOSCommands.lineFeed(1),

      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print grosir payment receipt (when a payment is recorded on an invoice).
   * Shows client name, date/time, kasir, paid amount / total, remaining, and "PEMBAYARAN LUNAS" when cleared.
   */
  async printGrosirPaymentReceipt(data: PaymentReceiptData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected");
    }

    const dateObj = typeof data.date === "string" ? new Date(data.date) : data.date;
    const formattedDate = new Intl.DateTimeFormat(["ban", "id"], {
      year: "numeric",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);

    const formatIDR = (amount: number): string => {
      const n = Math.round(amount);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const dotted = "................................................\n";
    const isLunas = data.remainingBalance <= 0;

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("BUKTI PEMBAYARAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text("TOKO EDYSON\n"),
      ESCPOSCommands.text("Pulau Burung KM.00\n"),
      ESCPOSCommands.text("Indragiri Hilir\n"),

      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.text(`Invoice: #${data.invoiceNo}\n`),
      ESCPOSCommands.text(`Pelanggan: ${data.customerName}\n`),
      ESCPOSCommands.text(`Kasir: ${data.cashierName}\n`),
      ESCPOSCommands.text(`Tanggal: ${formattedDate}\n`),
      ESCPOSCommands.text(dotted),

      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("DETAIL PEMBAYARAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(`Total Belanja: Rp ${formatIDR(data.totalBelanja)}\n`),
      ESCPOSCommands.text(`Total Setor: Rp ${formatIDR(data.setorGrosir)}\n`),
      ESCPOSCommands.text(`Pembayaran: Rp ${formatIDR(data.paymentAmount)} (${data.paymentMethod})\n`),
      ESCPOSCommands.text(`Sisa Bayaran: Rp ${formatIDR(data.remainingBalance)}\n`),
      ESCPOSCommands.text(dotted),

      ...(isLunas
        ? [
            ESCPOSCommands.setAlignment("center"),
            ESCPOSCommands.lineFeed(1),
            ESCPOSCommands.selectPrintMode({
              doubleHeight: true,
              doubleWidth: true,
              emphasized: true,
            }),
            ESCPOSCommands.text("PEMBAYARAN LUNAS\n"),
            ESCPOSCommands.selectPrintMode({}),
            ESCPOSCommands.lineFeed(1),
          ]
        : []),

      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text("Terima kasih!\n"),
      ESCPOSCommands.lineFeed(1),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print sales overview summary report (today's kontan + grosir with payment breakdowns)
   */
  async printSalesOverviewReport(data: SalesOverviewReportData): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Connect printer in Settings first.");
    }

    const formatIDR = (amount: number): string => {
      const n = Math.round(amount);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const now = data.printedAt || new Date();
    const jakartaOpt = { timeZone: "Asia/Jakarta" as const };
    const dateStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);
    const dayStr = new Intl.DateTimeFormat("id-ID", { ...jakartaOpt, weekday: "long" }).format(now);
    const timeStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const printedLine = `Dicetak: ${dateStr}, ${dayStr}, ${timeStr}\n`;

    const dotted = "................................................\n";
    const isBilliard = data.reportType === "billiard";

    // Grand total by payment: kontan + grosir setor per method
    const grandByPayment: Record<string, number> = {};
    Object.entries(data.kontanByPayment).forEach(([method, s]) => {
      grandByPayment[method] = (grandByPayment[method] || 0) + s.total;
    });
    Object.entries(data.grosirSetorByPayment).forEach(([method, s]) => {
      grandByPayment[method] = (grandByPayment[method] || 0) + s.total;
    });
    const billiardSessionCount = Object.values(data.kontanByPayment).reduce(
      (sum, s) => sum + s.count,
      0
    );

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true, doubleHeight: true, doubleWidth: true }),
      ESCPOSCommands.text("TIGA SEKAWAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(isBilliard ? "Laporan Sales Billiard\n" : "Laporan Penjualan\n"),
      ESCPOSCommands.text(`${data.dateLabel}\n`),
      ESCPOSCommands.text(printedLine),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(dotted),

      ...(isBilliard
        ? [
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.text("RINGKASAN BILLIARD\n"),
            ESCPOSCommands.selectPrintMode({}),
            ESCPOSCommands.text(`Total Sesi: ${billiardSessionCount} trx\n`),
            ESCPOSCommands.text(`Total Sales: Rp ${formatIDR(data.kontanTotal)}\n`),
            ESCPOSCommands.text(dotted),
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.text("PER CARA BAYAR\n"),
            ESCPOSCommands.selectPrintMode({}),
            ...Object.entries(data.kontanByPayment)
              .filter(([, s]) => s.count > 0 || s.total > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([method, s]) => [
                ESCPOSCommands.text(`  ${method}: Rp ${formatIDR(s.total)} (${s.count} trx)\n`),
              ]),
            ...(Object.entries(data.kontanByPayment).some(([, s]) => s.count > 0 || s.total > 0)
              ? []
              : [ESCPOSCommands.text("  -\n")]),
            ESCPOSCommands.text(dotted),
          ]
        : [
            // Jualan Kontan
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.text("JUALAN KONTAN\n"),
            ESCPOSCommands.selectPrintMode({}),
            ESCPOSCommands.text(`Total: Rp ${formatIDR(data.kontanTotal)}\n`),
            ...Object.entries(data.kontanByPayment)
              .filter(([, s]) => s.count > 0)
              .flatMap(([method, s]) => [
                ESCPOSCommands.text(`  ${method}: Rp ${formatIDR(s.total)} (${s.count} trx)\n`),
              ]),
            ESCPOSCommands.text(dotted),

            // Jualan Grosir
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.text("JUALAN GROSIR\n"),
            ESCPOSCommands.selectPrintMode({}),
            ESCPOSCommands.text(`Total Belanja: Rp ${formatIDR(data.grosirTotal)}\n`),
            ESCPOSCommands.text(`Total Setor: Rp ${formatIDR(data.grosirSetor)}\n`),
            ESCPOSCommands.text(`Total Sisa (Bon): Rp ${formatIDR(data.grosirSisa)}\n`),
            ESCPOSCommands.text("Setor per cara bayar:\n"),
            ...Object.entries(data.grosirSetorByPayment)
              .filter(([, s]) => s.count > 0)
              .flatMap(([method, s]) => [
                ESCPOSCommands.text(`  ${method}: Rp ${formatIDR(s.total)} (${s.count} trx)\n`),
              ]),
            ESCPOSCommands.text(dotted),

            // Sales by cashier (each user with payment method breakdown)
            ...(data.salesByCashier && Object.keys(data.salesByCashier).length > 0
              ? [
                  ESCPOSCommands.selectPrintMode({ emphasized: true }),
                  ESCPOSCommands.text("SALES BY CASHIER\n"),
                  ESCPOSCommands.selectPrintMode({}),
                  ...Object.entries(data.salesByCashier)
                    .sort(([, a], [, b]) => {
                      const totalA = Object.values(a).reduce((s, x) => s + x.total, 0);
                      const totalB = Object.values(b).reduce((s, x) => s + x.total, 0);
                      return totalB - totalA;
                    })
                    .flatMap(([cashier, byPayment]) => [
                      ESCPOSCommands.text(`${cashier.split("@")[0]}\n`),
                      ...Object.entries(byPayment)
                        .filter(([, s]) => s.count > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .flatMap(([method, s]) => [
                          ESCPOSCommands.text(`  ${method.toLowerCase()} IDR ${formatIDR(s.total)}\n`),
                        ]),
                    ]),
                  ESCPOSCommands.text(dotted),
                ]
              : []),

            // Grand total by payment (Cash, QRIS, others) at end of page
            ESCPOSCommands.selectPrintMode({ emphasized: true }),
            ESCPOSCommands.text("GRAND TOTAL PER CARA BAYAR\n"),
            ESCPOSCommands.selectPrintMode({}),
            ...Object.entries(grandByPayment)
              .filter(([, total]) => total > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([method, total]) => [
                ESCPOSCommands.text(`  ${method}: Rp ${formatIDR(total)}\n`),
              ]),
            ESCPOSCommands.text(dotted),
          ]),

      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text(`Printed by: ${data.printedBy || "—"}\n`),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print billiard table summary report (hours and sales per table).
   */
  async printBilliardTableSummaryReport(
    data: BilliardTableSummaryReportData
  ): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Connect printer in Settings first.");
    }

    const formatIDR = (amount: number): string => {
      const n = Math.round(amount);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
    const formatHours = (hours: number): string => {
      const rounded = Math.round(hours * 100) / 100;
      return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
    };

    const now = data.printedAt || new Date();
    const jakartaOpt = { timeZone: "Asia/Jakarta" as const };
    const dateStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);
    const dayStr = new Intl.DateTimeFormat("id-ID", { ...jakartaOpt, weekday: "long" }).format(now);
    const timeStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const printedLine = `Dicetak: ${dateStr}, ${dayStr}, ${timeStr}\n`;
    const dotted = "................................................\n";

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true, doubleHeight: true, doubleWidth: true }),
      ESCPOSCommands.text("TIGA SEKAWAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text("Laporan Meja Billiard\n"),
      ESCPOSCommands.text(`${data.dateLabel}\n`),
      ESCPOSCommands.text(printedLine),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("RINGKASAN PER MEJA\n"),
      ESCPOSCommands.selectPrintMode({}),
      ...(data.tables.length > 0
        ? data.tables
            .sort((a, b) => a.tableNumber - b.tableNumber)
            .flatMap((row) => [
              ESCPOSCommands.text(`Meja ${row.tableNumber}\n`),
              ESCPOSCommands.text(
                `  ${formatHours(row.totalHours)} jam, ${row.sessions} sesi\n`
              ),
              ESCPOSCommands.text(
                `  Sales: Rp ${formatIDR(row.totalSales)}\n`
              ),
            ])
        : [ESCPOSCommands.text("Tidak ada transaksi.\n")]),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text(`Total Sesi : ${data.grandTotalSessions}\n`),
      ESCPOSCommands.text(`Total Jam  : ${formatHours(data.grandTotalHours)}\n`),
      ESCPOSCommands.text(`Total Sales: Rp ${formatIDR(data.grandTotalSales)}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text(`Printed by: ${data.printedBy || "—"}\n`),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }

  /**
   * Print expenses summary report (Pengeluaran Toko).
   */
  async printExpensesSummaryReport(
    data: ExpensesSummaryReportData
  ): Promise<void> {
    if (!this.connection.isConnected()) {
      throw new Error("Printer not connected. Connect printer in Settings first.");
    }

    const formatIDR = (amount: number): string => {
      const n = Math.round(amount);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const now = data.printedAt || new Date();
    const jakartaOpt = { timeZone: "Asia/Jakarta" as const };
    const dateStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);
    const dayStr = new Intl.DateTimeFormat("id-ID", { ...jakartaOpt, weekday: "long" }).format(now);
    const timeStr = new Intl.DateTimeFormat("id-ID", {
      ...jakartaOpt,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const printedLine = `Dicetak: ${dateStr}, ${dayStr}, ${timeStr}\n`;
    const dotted = "................................................\n";

    const commands = ESCPOSCommands.combine(
      ESCPOSCommands.initialize(),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.selectPrintMode({ emphasized: true, doubleHeight: true, doubleWidth: true }),
      ESCPOSCommands.text("TIGA SEKAWAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text("LAPORAN PENGELUARAN TOKO\n"),
      ESCPOSCommands.text("--------------------------------\n"),
      ESCPOSCommands.text(`Dari   : ${data.startDateLabel}\n`),
      ESCPOSCommands.text(`Sampai : ${data.endDateLabel}\n`),
      ESCPOSCommands.text("--------------------------------\n"),
      ESCPOSCommands.text(printedLine),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text("RINGKASAN PENGELUARAN\n"),
      ESCPOSCommands.selectPrintMode({}),
      ...(data.items.length > 0
        ? data.items.flatMap((row) => [
            ESCPOSCommands.text(`${row.category}\n`),
            ...(row.description
              ? [ESCPOSCommands.text(`  ${row.description}\n`)]
              : []),
            ESCPOSCommands.text(
              `  Rp ${formatIDR(row.amount)}\n`
            ),
          ])
        : [ESCPOSCommands.text("Tidak ada pengeluaran.\n")]),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.selectPrintMode({ emphasized: true }),
      ESCPOSCommands.text(`TOTAL: Rp ${formatIDR(data.totalAmount)}\n`),
      ESCPOSCommands.selectPrintMode({}),
      ESCPOSCommands.text(dotted),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.text(`Printed by: ${data.printedBy || "—"}\n`),
      ESCPOSCommands.lineFeed(),
      ESCPOSCommands.cutPaper(0)
    );

    await this.connection.sendData(commands);
  }
}

/**
 * Create printer service instance
 * For web: use WebUSB for USB (direct, no server), Web Bluetooth for Bluetooth
 * For native: use platform-specific connection based on user preference
 */
async function createPrinterService(): Promise<ThermalPrinterService> {
  console.log(`[Printer] createPrinterService called. Platform: ${Platform.OS}`);
  
  // Check user preference for printer type (works on both web and native)
  try {
    const { getPrinterType } = await import('./printer-settings');
    const printerType = await getPrinterType();
    console.log(`[Printer] User preference: ${printerType}`);
    
    if (printerType === 'bluetooth') {
      if (Platform.OS === "web") {
        console.log("[Printer] ✓ Creating Web Bluetooth printer service (no server required)");
        const connection = new WebBluetoothPrinterConnection();
        return new ThermalPrinterService(connection);
      }
      console.log("[Printer] ✓ Creating native Bluetooth printer service");
      return new ThermalPrinterService(new BluetoothPrinterConnection());
    } else {
      // USB connection
      if (Platform.OS === "web") {
        // Web: use WebUSB for direct USB communication (no server required)
        // Check if WebUSB is available
        if (typeof navigator !== "undefined" && navigator.usb) {
          console.log("[Printer] ✓ Creating USB printer service (web - via WebUSB)");
          return new ThermalPrinterService(new WebUSBPrinterConnection());
        } else {
          // Fallback to local server if WebUSB not available
          console.log("[Printer] WebUSB not available, falling back to local server");
          const serverUrl = process.env.EXPO_PUBLIC_PRINTER_SERVER_URL || "http://localhost:3001";
          return new ThermalPrinterService(new LocalServerPrinterConnection(serverUrl));
        }
      } else {
        // Native: use USB connection
        console.log("[Printer] ✓ Creating USB printer service (native)");
        return new ThermalPrinterService(new DefaultPrinterConnection());
      }
    }
  } catch (error) {
    console.warn("[Printer] Error getting printer type, defaulting to Bluetooth:", error);
    // Default to Bluetooth (primary use)
    if (Platform.OS === "web") {
      console.log("[Printer] ✓ Fallback: Creating Web Bluetooth printer service");
      return new ThermalPrinterService(new WebBluetoothPrinterConnection());
    } else {
      console.log("[Printer] ✓ Fallback: Creating native Bluetooth printer service");
      return new ThermalPrinterService(new BluetoothPrinterConnection());
    }
  }
}

// Create a function to get or recreate the printer service
let printerServiceInstance: ThermalPrinterService | null = null;
let printerServicePromise: Promise<ThermalPrinterService> | null = null;
let currentPrinterType: PrinterType | null = null;

export async function getPrinterService(): Promise<ThermalPrinterService> {
  // If printer type changed, recreate the service (web: USB vs Web Bluetooth; native: USB vs Bluetooth)
  try {
    const { getPrinterType } = await import('./printer-settings');
    const printerType = await getPrinterType();
    console.log(`[Printer] getPrinterService called. Current: ${currentPrinterType}, Requested: ${printerType}`);
    
    if (currentPrinterType !== null && currentPrinterType !== printerType) {
      console.log(`[Printer] Printer type changed from ${currentPrinterType} to ${printerType}, recreating service`);
      return await recreatePrinterService();
    }
    currentPrinterType = printerType;
  } catch (error) {
    console.warn("[Printer] Error checking printer type:", error);
  }
  
  if (!printerServiceInstance) {
    console.log("[Printer] No service instance, creating new one...");
    if (!printerServicePromise) {
      printerServicePromise = createPrinterService();
    }
    try {
      printerServiceInstance = await printerServicePromise;
    } catch (error) {
      // Reset promise on error so we can try again
      printerServicePromise = null;
      throw error;
    }
  }
  return printerServiceInstance;
}

/**
 * Recreate printer service with new connection type
 * Call this when user changes printer type in settings
 */
export async function recreatePrinterService(): Promise<ThermalPrinterService> {
  // Disconnect current service if connected
  if (printerServiceInstance && printerServiceInstance.isConnected()) {
    try {
      await printerServiceInstance.disconnect();
    } catch (error) {
      console.warn("[Printer] Error disconnecting old service:", error);
    }
  }
  
  // Reset instance and create new service
  printerServiceInstance = null;
  printerServicePromise = null;
  currentPrinterType = null; // Reset to force check on next getPrinterService()
  printerServiceInstance = await createPrinterService();
  
  // Update current printer type for ALL platforms (including web)
  try {
    const { getPrinterType } = await import('./printer-settings');
    currentPrinterType = await getPrinterType();
    console.log(`[Printer] Service recreated with type: ${currentPrinterType}`);
  } catch (error) {
    console.warn("[Printer] Error getting printer type:", error);
  }
  
  return printerServiceInstance;
}

// Create a proxy object that forwards calls to the actual service
// This maintains backward compatibility while supporting async initialization
class PrinterServiceProxy {
  private async getService(): Promise<ThermalPrinterService> {
    return await getPrinterService();
  }

  async initialize(): Promise<void> {
    return (await this.getService()).initialize();
  }

  async getAvailablePrinters(): Promise<PrinterDevice[]> {
    return (await this.getService()).getAvailablePrinters();
  }

  async connect(device: PrinterDevice): Promise<void> {
    return (await this.getService()).connect(device);
  }

  async disconnect(): Promise<void> {
    return (await this.getService()).disconnect();
  }

  isConnected(): boolean {
    // This is synchronous, so we need to check if instance exists
    // For async checks, user should use getPrinterService()
    return printerServiceInstance?.isConnected() || false;
  }

  getConnectionStatus(): { connected: boolean; device: PrinterDevice | null } {
    // Synchronous check - get current instance if available
    if (printerServiceInstance) {
      return printerServiceInstance.getConnectionStatus();
    }
    return { connected: false, device: null };
  }

  getConnectedDevice(): PrinterDevice | null {
    if (printerServiceInstance) {
      return printerServiceInstance.getConnectedDevice();
    }
    return null;
  }

  async testConnection(): Promise<boolean> {
    return (await this.getService()).testConnection();
  }

  async printTestReceipt(): Promise<void> {
    return (await this.getService()).printTestReceipt();
  }

  async printText(text: string, options?: {
    align?: "left" | "center" | "right";
    emphasized?: boolean;
    doubleHeight?: boolean;
    doubleWidth?: boolean;
  }): Promise<void> {
    return (await this.getService()).printText(text, options);
  }

  async getStatus(): Promise<PrinterStatus> {
    return (await this.getService()).getStatus();
  }

  async printCashReceipt(data: ReceiptData): Promise<void> {
    return (await this.getService()).printCashReceipt(data);
  }

  async printWholesaleReceipt(data: ReceiptData): Promise<void> {
    return (await this.getService()).printWholesaleReceipt(data);
  }

  async printGrosirSuratJalan(data: ReceiptData): Promise<void> {
    return (await this.getService()).printGrosirSuratJalan(data);
  }

  async printGrosirPaymentReceipt(data: PaymentReceiptData): Promise<void> {
    return (await this.getService()).printGrosirPaymentReceipt(data);
  }

  async printSalesOverviewReport(data: SalesOverviewReportData): Promise<void> {
    return (await this.getService()).printSalesOverviewReport(data);
  }

  async printBilliardTableSummaryReport(
    data: BilliardTableSummaryReportData
  ): Promise<void> {
    return (await this.getService()).printBilliardTableSummaryReport(data);
  }

  async printBilliardStartReceipt(data: BilliardStartReceiptData): Promise<void> {
    return (await this.getService()).printBilliardStartReceipt(data);
  }

  async printBilliardPaymentReceipt(data: BilliardPaymentReceiptData): Promise<void> {
    return (await this.getService()).printBilliardPaymentReceipt(data);
  }

  async printExpensesSummaryReport(
    data: ExpensesSummaryReportData
  ): Promise<void> {
    return (await this.getService()).printExpensesSummaryReport(data);
  }
}

// Export proxy instance for backward compatibility
export const thermalPrinter = new PrinterServiceProxy();
