/**
 * Telegram integration service
 * Sends PDF receipts and notifications to Telegram
 * Based on the old system implementation
 */

import { formatIDR } from "@/utils/currency";
import type { PaymentReceiptData, ReceiptData } from "@/utils/receipt-formatter";
import { generatePaymentReceiptHTML } from "@/utils/receipt-formatter";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { generatePDFFromHTML, shareReceiptAsPDF } from "./receipt-generator";

// Telegram configuration from old system
const TELEGRAM_BOT_TOKEN =
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_TOKEN || "1818313300:AAHoQ2CB2CwPiDOTxLpky78XvWmeID1YMP0";
const TELEGRAM_CHAT_ID_KONTAN = process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID_KONTAN || "-510529386";
const TELEGRAM_CHAT_ID_GROSIR = process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID_GROSIR || "-542841771";

/**
 * Verify Telegram bot token
 */
async function verifyBotToken(): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("Invalid bot token");
      return false;
    }

    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error("Error verifying bot token:", error);
    return false;
  }
}

/**
 * Send PDF document to Telegram
 * Uses React Native FormData format
 */
async function sendPDFToTelegram(
  pdfUri: string,
  chatId: string,
  documentName: string
): Promise<boolean> {
  try {
    console.log("Preparing to send PDF to Telegram...");
    console.log("PDF URI:", pdfUri);
    console.log("Chat ID:", chatId);
    console.log("Document name:", documentName);

    const formData = new FormData();

    // Use Platform.OS only - avoid (window && Blob) which can misidentify mobile as web
    const isWeb = Platform.OS === "web";

    if (isWeb) {
      // Web: Fetch the blob/file and convert to Blob
      console.log("Web platform detected, fetching PDF...");
      try {
        const response = await fetch(pdfUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const blob = await response.blob();
        console.log("PDF fetched as blob, size:", blob.size);
        formData.append("document", blob, documentName);
        console.log("Using Blob for web platform");
      } catch (fetchError) {
        console.error("Error fetching PDF on web:", fetchError);
        // If it's a blob URL that doesn't work, try reading as data URL
        throw new Error("Failed to fetch PDF file for Telegram");
      }
    } else {
      // Native (Android/iOS): try multiple strategies for robust mobile upload
      console.log("Native platform detected, preparing PDF upload...");

      const normalizedUri =
        pdfUri.startsWith("file://") || pdfUri.startsWith("content://") ? pdfUri : `file://${pdfUri}`;

      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      if (!fileInfo.exists) {
        throw new Error(`PDF file does not exist at: ${normalizedUri}`);
      }
      console.log("PDF file exists, size:", fileInfo.size);

      // Strategy 1: Direct URI (works on many devices)
      formData.append(
        "document",
        {
          uri: normalizedUri,
          name: documentName,
          type: "application/pdf",
        } as any
      );
      console.log("Using file URI for native platform");
    }

    formData.append("chat_id", chatId);
    console.log("FormData prepared, sending to Telegram...");

    const doSend = async (fd: FormData): Promise<{ ok: boolean; description?: string }> => {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
        {
          method: "POST",
          headers: {},
          body: fd,
        }
      );
      const data = await response.json();
      return { ok: data.ok === true, description: data.description };
    };

    let result = await doSend(formData);

    // Native fallbacks: if direct URI fails, copy to cache and retry
    if (!result.ok && !isWeb) {
      console.log("Direct URI upload failed, trying cache-copy fallback...");
      try {
        const cacheDir = FileSystem.cacheDirectory;
        if (cacheDir) {
          const safeName = documentName.replace(/[#\s()]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "") || "telegram_pdf.pdf";
          const destUri = `${cacheDir}${safeName}`;
          const normalizedUri =
            pdfUri.startsWith("file://") || pdfUri.startsWith("content://")
              ? pdfUri
              : `file://${pdfUri}`;
          await FileSystem.copyAsync({ from: normalizedUri, to: destUri });
          const cacheFormData = new FormData();
          cacheFormData.append(
            "document",
            {
              uri: destUri.startsWith("file://") ? destUri : `file://${destUri}`,
              name: documentName,
              type: "application/pdf",
            } as any
          );
          cacheFormData.append("chat_id", chatId);
          result = await doSend(cacheFormData);
          if (result.ok) {
            console.log("Cache-copy upload succeeded");
          }
        }
      } catch (fallbackErr) {
        console.warn("Cache-copy fallback failed:", fallbackErr);
      }
    }

    if (result.ok) {
      console.log("PDF sent to Telegram successfully!");
      return true;
    } else {
      const errorMsg = result.description || "Failed to send document";
      console.error("Telegram API error:", errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error: any) {
    console.error("Error sending PDF to Telegram:", error);
    console.error("Error stack:", error?.stack);
    throw error;
  }
}

/**
 * Send text message to Telegram
 */
async function sendMessageToTelegram(chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const responseData = await response.json();
    console.log("Telegram Message Response:", responseData);

    if (responseData.ok) {
      return true;
    } else {
      throw new Error(responseData.description || "Failed to send message");
    }
  } catch (error: any) {
    console.error("Error sending message to Telegram:", error);
    throw error;
  }
}

/**
 * Send cash sale receipt to Telegram (Kontan)
 * Matches the old system's sentTelegramChat function
 *
 * @param receiptData - Receipt data including items, total, payment info
 * @param kembalian - Change amount (for cash payments)
 */
/**
 * Send cash sale receipt to Telegram using an existing PDF URI
 * This allows using the same PDF for both printing and Telegram
 */
export async function sendCashSaleToTelegramWithPDF(
  pdfUri: string,
  receiptData: ReceiptData
): Promise<void> {
  try {
    console.log("Starting Telegram send process with existing PDF...");
    console.log("PDF URI:", pdfUri);

    // Verify bot token first (matches old system)
    console.log("Verifying bot token...");
    const isValid = await verifyBotToken();
    if (!isValid) {
      console.error("Invalid Telegram bot token");
      throw new Error("Invalid Telegram bot token");
    }
    console.log("Bot token verified");

    // Document name format: ${totalAmountValuePDF}_Kontan.pdf
    // Remove currency formatting to get just numbers
    const totalAmountValuePDF = formatIDR(receiptData.total).replace(/[^0-9]/g, "");
    const documentName = `${totalAmountValuePDF}_Kontan.pdf`;
    console.log("Document name:", documentName);

    // Send PDF to Telegram
    console.log("Sending PDF to Telegram...");
    const success = await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_KONTAN, documentName);

    if (success) {
      console.log("Cash sale receipt sent to Telegram successfully");
    } else {
      throw new Error("Failed to send PDF to Telegram");
    }
  } catch (error: any) {
    console.error("Error sending cash sale to Telegram:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    throw error;
  }
}

export async function sendCashSaleToTelegram(
  receiptData: ReceiptData,
  kembalian: number
): Promise<void> {
  try {
    console.log("Starting Telegram send process...");

    // Verify bot token first (matches old system)
    console.log("Verifying bot token...");
    const isValid = await verifyBotToken();
    if (!isValid) {
      console.error("Invalid Telegram bot token");
      throw new Error("Invalid Telegram bot token");
    }
    console.log("Bot token verified");

    // Generate PDF using the same method as receipt printing
    console.log("Generating PDF...");
    const pdfUri = await shareReceiptAsPDF(receiptData, "cash", "A6");
    console.log("PDF generated at:", pdfUri);

    // Use the new function to send
    await sendCashSaleToTelegramWithPDF(pdfUri, receiptData);
  } catch (error: any) {
    console.error("Error sending cash sale to Telegram:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Send wholesale sale receipt to Telegram (Grosir)
 * Matches the old system's sentTelegramChatPDF and sentTelegramChat functions
 *
 * @param receiptData - Receipt data including items, total, customer info
 * @param format - Receipt format ('A4' or 'A6')
 * @param invoiceNo - Invoice number
 * @param watermarkText - Watermark text ('TOKO EDYSON' for Nota, 'SURAT JALAN' for Surat Jalan)
 */
export async function sendWholesaleSaleToTelegram(
  receiptData: ReceiptData,
  format: "A4" | "A6" = "A4",
  invoiceNo: number,
  watermarkText: string = "TOKO EDYSON"
): Promise<void> {
  try {
    // Verify bot token first (matches old system)
    const isValid = await verifyBotToken();
    if (!isValid) {
      throw new Error("Invalid Telegram bot token");
    }

    const customerName = receiptData.customerName || "Unknown";
    const totalAmountValuePDF = formatIDR(receiptData.total);

    // Send text message first (matches old system's sentTelegramChat)
    // Format: ${namaPelanggan} #${invoiceNo}_G_${size} belanja ${totalAmountValuePDF}
    const message = `${customerName} #${invoiceNo}_G_${format} belanja ${totalAmountValuePDF}`;
    await sendMessageToTelegram(TELEGRAM_CHAT_ID_GROSIR, message);

    if (format === "A4") {
      // Default (new flow): send ONE A4 PDF to Telegram
      const pdfUri = await shareReceiptAsPDF(
        receiptData,
        "wholesale",
        "A4",
        true,
        watermarkText
      );
      const documentName = `${customerName} #${invoiceNo}_G_${format}_(${totalAmountValuePDF.replace(
        /[^0-9]/g,
        ""
      )}).pdf`;
      await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_GROSIR, documentName);
    } else {
      // For A6, send 1 PDF (matches old system)
      const pdfUri = await shareReceiptAsPDF(receiptData, "wholesale", "A6");
      // Document name format: ${namaPelanggan} #${invoiceNo}_G_${size}_(${totalAmountValuePDF}).pdf
      const documentName = `${customerName} #${invoiceNo}_G_${format}_(${totalAmountValuePDF.replace(
        /[^0-9]/g,
        ""
      )}).pdf`;
      await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_GROSIR, documentName);
    }

    console.log("Wholesale sale receipt sent to Telegram successfully");
  } catch (error: any) {
    console.error("Error sending wholesale sale to Telegram:", error);
    throw error;
  }
}

/**
 * Send payment receipt to Telegram for wholesale payments
 *
 * @param paymentData - Payment receipt data including customer, invoice, payment amount, etc.
 */
export async function sendPaymentReceiptToTelegram(paymentData: PaymentReceiptData): Promise<void> {
  try {
    // Verify bot token first
    const isValid = await verifyBotToken();
    if (!isValid) {
      throw new Error("Invalid Telegram bot token");
    }

    const customerName = paymentData.customerName || "Unknown";
    const paymentAmountValue = formatIDR(paymentData.paymentAmount).replace(/[^0-9]/g, "");

    // Generate payment receipt HTML (A4 with watermark for client)
    const paymentReceiptHTML = generatePaymentReceiptHTML(
      paymentData,
      "A4",
      true,
      "TOKO EDYSON"
    );

    // Generate PDF from HTML using A4 size
    const pdfUri = await generatePDFFromHTML(paymentReceiptHTML, 210);

    // Send text message first
    const message = `${customerName} #${paymentData.invoiceNo} pembayaran ${formatIDR(
      paymentData.paymentAmount
    )}`;
    await sendMessageToTelegram(TELEGRAM_CHAT_ID_GROSIR, message);

    // Send PDF
    const documentName = `${customerName} #${paymentData.invoiceNo}_PEMBAYARAN_(${paymentAmountValue}).pdf`;
    await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_GROSIR, documentName);

    console.log("Payment receipt sent to Telegram successfully");
  } catch (error: any) {
    console.error("Error sending payment receipt to Telegram:", error);
    throw error;
  }
}
