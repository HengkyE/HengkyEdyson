/**
 * Telegram integration service
 * Sends PDF receipts and notifications to Telegram
 * Based on the old system implementation
 */

import { formatIDR } from "@/utils/currency";
import type { PaymentReceiptData, ReceiptData } from "@/utils/receipt-formatter";
import { generatePaymentReceiptHTML } from "@/utils/receipt-formatter";
import * as FileSystem from "expo-file-system/legacy";
import { FileSystemUploadType } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { generatePDFFromHTML, shareReceiptAsPDF } from "./receipt-generator";

// Telegram configuration from old system
const TELEGRAM_BOT_TOKEN =
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_TOKEN?.trim() || "";
const TELEGRAM_CHAT_ID_SEKAWAN =
  process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID_SEKAWAN?.trim() ||
  process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID_KONTAN?.trim() ||
  "";
const TELEGRAM_CHAT_ID_GROSIR = process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID_GROSIR?.trim() || "";

function ensureTelegramConfig(): void {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing EXPO_PUBLIC_TELEGRAM_BOT_TOKEN in .env");
  }
}

const TELEGRAM_SEND_DOCUMENT_URL = () =>
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

function sanitizePdfFileName(name: string): string {
  const trimmed = (name || "document.pdf").trim();
  const safe = trimmed.replace(/[^\w.\- ()]/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

function normalizeNativeUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("content://")) return uri;
  return `file://${uri}`;
}

function buildNamedCachePdfUri(fileName: string): string {
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
  const stamp = Date.now();
  return `${cacheDir}telegram_${stamp}_${fileName}`;
}

function parseTelegramResult(raw: string): { ok?: boolean; description?: string } {
  try {
    return JSON.parse(raw) as { ok?: boolean; description?: string };
  } catch {
    return { ok: false, description: raw || "Invalid Telegram response" };
  }
}

async function sendPdfWithUploadAsync(
  fileUri: string,
  chatId: string,
  documentName: string
): Promise<void> {
  const uploadResult = await FileSystem.uploadAsync(TELEGRAM_SEND_DOCUMENT_URL(), fileUri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "document",
    mimeType: "application/pdf",
    parameters: {
      chat_id: chatId,
      disable_content_type_detection: "true",
    },
  });
  const parsed = parseTelegramResult(uploadResult.body);
  if (!parsed.ok) {
    throw new Error(parsed.description || "Failed to send document");
  }
  console.log("PDF sent to Telegram successfully (uploadAsync):", documentName);
}

async function sendPdfWithFormData(
  fileUri: string,
  chatId: string,
  documentName: string
): Promise<void> {
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append(
    "document",
    {
      uri: fileUri,
      name: documentName,
      type: "application/pdf",
    } as any
  );
  const response = await fetch(TELEGRAM_SEND_DOCUMENT_URL(), {
    method: "POST",
    body: formData,
  });
  const responseData = await response.json();
  if (!responseData?.ok) {
    throw new Error(responseData?.description || "Failed to send document");
  }
  console.log("PDF sent to Telegram successfully (FormData fallback):", documentName);
}

/**
 * Verify Telegram bot token
 */
async function verifyBotToken(): Promise<boolean> {
  try {
    ensureTelegramConfig();
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
    ensureTelegramConfig();
    if (!chatId) {
      throw new Error("Missing Telegram chat id in environment variables.");
    }
    const safeName = sanitizePdfFileName(documentName);
    console.log("Preparing to send PDF to Telegram...");
    console.log("PDF URI:", pdfUri);
    console.log("Chat ID:", chatId);
    console.log("Document name:", safeName);

    // Check if we're on web or native
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
        const formData = new FormData();
        formData.append("document", blob, safeName);
        formData.append("chat_id", chatId);
        console.log("Using Blob for web platform");
        const uploadResponse = await fetch(TELEGRAM_SEND_DOCUMENT_URL(), {
          method: "POST",
          body: formData,
        });
        const responseData = await uploadResponse.json();
        if (responseData.ok) {
          console.log("PDF sent to Telegram successfully!");
          return true;
        }
        throw new Error(responseData.description || "Failed to send document");
      } catch (fetchError) {
        console.error("Error fetching PDF on web:", fetchError);
        throw new Error("Failed to fetch PDF file for Telegram");
      }
    }
    // Native (Android/iOS): try robust upload strategy with multiple fallbacks.
    const normalizedUri = normalizeNativeUri(pdfUri);
    const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
    if (!fileInfo.exists) {
      throw new Error(`PDF file does not exist at: ${normalizedUri}`);
    }
    console.log("PDF file exists, size:", fileInfo.size);

    const errors: string[] = [];

    // iOS: prefer FormData to preserve custom filename reliably.
    if (Platform.OS === "ios") {
      try {
        await sendPdfWithFormData(normalizedUri, chatId, safeName);
        return true;
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`ios(fetch/FormData): ${msg}`);
      }
    }

    // Android and iOS fallback: copy into cache with desired filename, then upload.
    let cachePdfUri: string | null = null;
    try {
      const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      cachePdfUri = buildNamedCachePdfUri(safeName);
      await FileSystem.writeAsStringAsync(cachePdfUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      errors.push(`cache-copy: ${msg}`);
    }

    // Android prefers uploadAsync.
    if (cachePdfUri) {
      try {
        await sendPdfWithUploadAsync(cachePdfUri, chatId, safeName);
        return true;
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`uploadAsync(cache-copy): ${msg}`);
      }
    }

    // Last fallback: FormData upload.
    try {
      await sendPdfWithFormData(cachePdfUri || normalizedUri, chatId, safeName);
      return true;
    } catch (err: any) {
      const msg = err?.message || String(err);
      errors.push(`fetch(FormData): ${msg}`);
    }
    throw new Error(`Failed to send PDF to Telegram. ${errors.join(" | ")}`);
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
    ensureTelegramConfig();
    if (!chatId) {
      throw new Error("Missing Telegram chat id in environment variables.");
    }
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

export interface BilliardSalesPdfReportData {
  dateLabel: string;
  fileTitle?: string;
  printedAt?: Date;
  printedBy?: string;
  showOperationalChart?: boolean;
  operationWindowStart?: string;
  operationWindowEnd?: string;
  totalRevenue: number;
  totalSessions: number;
  totalExpenses?: number;
  expenses?: Array<{
    category: string;
    description: string | null;
    amount: number;
    expenseDate: string;
  }>;
  byPaymentMethod: Record<string, { count: number; total: number }>;
  tableSummary: Array<{
    tableNumber: number;
    sessions: number;
    totalHours: number;
    totalSales: number;
  }>;
  sessionDetails: Array<{
    tableNumber: number;
    startedAt?: string | null;
    paidAt?: string | null;
    durationHours: number;
    ratePerHour: number;
    amount: number;
    paymentMethod: string;
  }>;
}

export interface BilliardSalesDetailPdfData {
  dateLabel: string;
  fileTitle?: string;
  printedAt?: Date;
  printedBy?: string;
  sessionDetails: BilliardSalesPdfReportData["sessionDetails"];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateForReport(value?: string | Date | null): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function buildOperationalChartSection(data: BilliardSalesPdfReportData): string {
  if (!data.showOperationalChart || !data.operationWindowStart || !data.operationWindowEnd) {
    const tableRows =
      data.tableSummary
        .sort((a, b) => a.tableNumber - b.tableNumber)
        .map(
          (row) => `
          <tr>
            <td>Meja ${row.tableNumber}</td>
            <td class="right">${row.sessions}</td>
            <td class="right">${row.totalHours.toFixed(2)}</td>
            <td class="right">${formatIDR(row.totalSales)}</td>
          </tr>
        `
        )
        .join("") || `<tr><td colspan="4" class="empty">Tidak ada data</td></tr>`;
    return `
      <div class="section">
        <h3>Ringkasan Per Meja</h3>
        <table>
          <thead>
            <tr>
              <th>Meja</th>
              <th class="right">Sesi</th>
              <th class="right">Jam Terpakai</th>
              <th class="right">Sales</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;
  }

  const windowStart = new Date(data.operationWindowStart);
  const windowEnd = new Date(data.operationWindowEnd);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    return `<div class="section"><h3>Ringkasan Per Meja</h3><div class="empty">Rentang waktu operasi tidak valid.</div></div>`;
  }

  // 14 hours operation (13:00 -> 03:00) with 30-min slots => 28 slots.
  const slotMinutes = 30;
  const slotMs = slotMinutes * 60 * 1000;
  const totalSlots = Math.round((windowEnd.getTime() - windowStart.getTime()) / slotMs);

  const tableRows = data.tableSummary
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .map((row) => {
      const slots = Array.from({ length: totalSlots }, () => false);
      const sessions = data.sessionDetails.filter((s) => Number(s.tableNumber) === Number(row.tableNumber));

      sessions.forEach((s) => {
        const sessionStart =
          s.startedAt && !Number.isNaN(new Date(s.startedAt).getTime())
            ? new Date(s.startedAt)
            : s.paidAt && !Number.isNaN(new Date(s.paidAt).getTime())
              ? new Date(new Date(s.paidAt).getTime() - Number(s.durationHours || 0) * 3_600_000)
              : null;

        if (!sessionStart) return;
        const sessionEnd = new Date(sessionStart.getTime() + Number(s.durationHours || 0) * 3_600_000);
        const clipStart = Math.max(sessionStart.getTime(), windowStart.getTime());
        const clipEnd = Math.min(sessionEnd.getTime(), windowEnd.getTime());
        if (clipEnd <= clipStart) return;

        const startIdx = Math.max(0, Math.floor((clipStart - windowStart.getTime()) / slotMs));
        const endIdx = Math.min(totalSlots, Math.ceil((clipEnd - windowStart.getTime()) / slotMs));
        for (let i = startIdx; i < endIdx; i++) slots[i] = true;
      });

      const usedSlots = slots.filter(Boolean).length;
      const usedHours = usedSlots / 2;
      const bar = slots
        .map((used) => `<span class="gantt-slot ${used ? "used" : "unused"}"></span>`)
        .join("");

      return `
      <div class="gantt-row">
        <div class="gantt-row-header">
          <div class="gantt-title">Meja ${row.tableNumber}</div>
          <div class="gantt-metrics">
            <span>${usedHours.toFixed(1)}/14 hrs</span>
            <span>${formatIDR(row.totalSales)}</span>
          </div>
        </div>
        <div class="gantt-bar">${bar}</div>
      </div>`;
    })
    .join("");

  return `
    <div class="section">
      <h3>Ringkasan Per Meja (Operasional 13:00 - 03:00)</h3>
      <div class="gantt-legend">
        <span class="legend-item"><span class="legend-box used"></span>Jam terpakai</span>
        <span class="legend-item"><span class="legend-box unused"></span>Jam kosong</span>
      </div>
      <div class="gantt-time-labels">
        <span>13:00</span><span>17:00</span><span>21:00</span><span>01:00</span><span>03:00</span>
      </div>
      <div class="gantt-container">${tableRows || '<div class="empty">Tidak ada data meja.</div>'}</div>
    </div>
  `;
}

function buildBilliardSalesSummaryHTML(data: BilliardSalesPdfReportData): string {
  const printedAt = formatDateForReport(data.printedAt ?? new Date());
  const paymentRows =
    Object.entries(data.byPaymentMethod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([method, stats]) => `
          <tr>
            <td>${escapeHtml(method)}</td>
            <td class="right">${stats.count}</td>
            <td class="right">${formatIDR(stats.total)}</td>
          </tr>
        `
      )
      .join("") ||
    `<tr><td colspan="3" class="empty">Tidak ada data</td></tr>`;

  const operationalChartSection = buildOperationalChartSection(data);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>TigaSekawan - Billiard Sales Summary</title>
  <style>
    @page { size: A4; margin: 18mm 12mm; }
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 12px; }
    .header { text-align: center; margin-bottom: 14px; }
    .brand { font-size: 24px; font-weight: 700; letter-spacing: 1px; }
    .title { font-size: 14px; font-weight: 700; margin-top: 4px; }
    .meta { color: #4b5563; margin-top: 4px; font-size: 11px; }
    .cards { display: table; width: 100%; border-spacing: 8px; margin: 12px 0; }
    .card { display: table-cell; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
    .card .label { color: #6b7280; font-size: 11px; margin-bottom: 4px; }
    .card .value { font-size: 16px; font-weight: 700; }
    .section { margin-top: 14px; }
    .section h3 { font-size: 13px; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; }
    td.right, th.right { text-align: right; }
    .empty { text-align: center; color: #6b7280; }
    .net-row { margin: 12px 0; padding: 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .net-label { font-size: 12px; color: #166534; font-weight: 600; }
    .net-value { font-size: 16px; font-weight: 700; color: #166534; }
    .gantt-legend { display: flex; gap: 14px; margin-bottom: 6px; font-size: 11px; color: #374151; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .legend-box { display: inline-block; width: 10px; height: 10px; border-radius: 2px; border: 1px solid #d1d5db; }
    .legend-box.used { background: #16a34a; }
    .legend-box.unused { background: #ef4444; }
    .gantt-time-labels { display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; margin-bottom: 6px; }
    .gantt-container { display: flex; flex-direction: column; gap: 8px; }
    .gantt-row { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; }
    .gantt-row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .gantt-title { font-size: 12px; font-weight: 700; }
    .gantt-metrics { display: flex; gap: 10px; font-size: 11px; color: #111827; }
    .gantt-bar { display: grid; grid-template-columns: repeat(28, minmax(0, 1fr)); gap: 1px; background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 4px; padding: 1px; }
    .gantt-slot { height: 10px; display: block; border-radius: 1px; }
    .gantt-slot.used { background: #16a34a; }
    .gantt-slot.unused { background: #ef4444; }
    .footer { margin-top: 14px; font-size: 10px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">TIGA SEKAWAN</div>
    <div class="title">BILLIARD SALES SUMMARY REPORT</div>
    <div class="meta">${escapeHtml(data.dateLabel)}</div>
    <div class="meta">Dicetak: ${escapeHtml(printedAt)} • Oleh: ${escapeHtml(
      data.printedBy || "Kasir"
    )}</div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">Total Sales</div>
      <div class="value">${formatIDR(data.totalRevenue)}</div>
    </div>
    <div class="card">
      <div class="label">Total Sesi</div>
      <div class="value">${data.totalSessions}</div>
    </div>
    <div class="card">
      <div class="label">Total Pengeluaran</div>
      <div class="value" style="color: #dc2626;">${formatIDR(data.totalExpenses ?? 0)}</div>
    </div>
    <div class="card">
      <div class="label">Total Meja Aktif</div>
      <div class="value">${data.tableSummary.length}</div>
    </div>
  </div>
  ${
    (data.totalExpenses ?? 0) > 0
      ? `
  <div class="net-row">
    <span class="net-label">Laba Bersih (Sales - Pengeluaran)</span>
    <span class="net-value">${formatIDR(data.totalRevenue - (data.totalExpenses ?? 0))}</span>
  </div>
  `
      : ""
  }

  <div class="section">
    <h3>Ringkasan Metode Pembayaran</h3>
    <table>
      <thead>
        <tr>
          <th>Metode</th>
          <th class="right">Sesi</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>
  </div>

  ${
    (data.expenses?.length ?? 0) > 0
      ? `
  <div class="section">
    <h3>Daftar Pengeluaran</h3>
    <table>
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Deskripsi</th>
          <th class="right">Jumlah</th>
        </tr>
      </thead>
      <tbody>${(data.expenses ?? [])
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.description ?? "-")}</td>
          <td class="right" style="color: #dc2626;">${formatIDR(row.amount)}</td>
        </tr>
      `
        )
        .join("")}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="right"><strong>Total Pengeluaran</strong></td>
          <td class="right" style="color: #dc2626;"><strong>${formatIDR(
            data.totalExpenses ?? 0
          )}</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>
  `
      : ""
  }

  ${operationalChartSection}

  <div class="footer">TigaSekawan Billiard • Generated by system</div>
</body>
</html>`;
}

function buildBilliardSalesDetailHTML(data: BilliardSalesDetailPdfData): string {
  const printedAt = formatDateForReport(data.printedAt ?? new Date());

  const detailRows =
    data.sessionDetails
      .map(
        (row) => `
          <tr>
            <td>Meja ${row.tableNumber}</td>
            <td>${escapeHtml(formatDateForReport(row.paidAt))}</td>
            <td class="right">${row.durationHours.toFixed(2)}</td>
            <td class="right">${formatIDR(row.ratePerHour)}</td>
            <td>${escapeHtml(row.paymentMethod)}</td>
            <td class="right">${formatIDR(row.amount)}</td>
          </tr>
        `
      )
      .join("") || `<tr><td colspan="6" class="empty">Tidak ada sesi dibayar</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>TigaSekawan - Billiard Paid Sessions Detail</title>
  <style>
    @page { size: A4; margin: 18mm 12mm; }
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 12px; }
    .header { text-align: center; margin-bottom: 14px; }
    .brand { font-size: 24px; font-weight: 700; letter-spacing: 1px; }
    .title { font-size: 14px; font-weight: 700; margin-top: 4px; }
    .meta { color: #4b5563; margin-top: 4px; font-size: 11px; }
    .section { margin-top: 14px; }
    .section h3 { font-size: 13px; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; }
    td.right, th.right { text-align: right; }
    .empty { text-align: center; color: #6b7280; }
    .footer { margin-top: 14px; font-size: 10px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">TIGA SEKAWAN</div>
    <div class="title">DETAIL SESI MEJA DIBAYAR</div>
    <div class="meta">${escapeHtml(data.dateLabel)}</div>
    <div class="meta">Dicetak: ${escapeHtml(printedAt)} • Oleh: ${escapeHtml(
      data.printedBy || "Kasir"
    )}</div>
  </div>

  <div class="section">
    <h3>Detail Sesi Dibayar</h3>
    <table>
      <thead>
        <tr>
          <th>Meja</th>
          <th>Waktu Bayar</th>
          <th class="right">Durasi (jam)</th>
          <th class="right">Tarif/jam</th>
          <th>Metode</th>
          <th class="right">Jumlah</th>
        </tr>
      </thead>
      <tbody>${detailRows}</tbody>
    </table>
  </div>

  <div class="footer">TigaSekawan Billiard • Generated by system</div>
</body>
</html>`;
}

export async function sendBilliardSalesSummaryPDFToTelegram(
  data: BilliardSalesPdfReportData
): Promise<void> {
  const isValid = await verifyBotToken();
  if (!isValid) {
    throw new Error("Invalid Telegram bot token");
  }

  const html = buildBilliardSalesSummaryHTML(data);
  const pdfUri = await generatePDFFromHTML(html, 210);
  const documentName = `${data.fileTitle?.trim() || "Laporan"}.pdf`;
  await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_SEKAWAN, documentName);
}

export async function sendBilliardSalesDetailPDFToTelegram(
  data: BilliardSalesDetailPdfData
): Promise<void> {
  const isValid = await verifyBotToken();
  if (!isValid) {
    throw new Error("Invalid Telegram bot token");
  }

  const html = buildBilliardSalesDetailHTML(data);
  const pdfUri = await generatePDFFromHTML(html, 210);
  const documentName = `${data.fileTitle?.trim() || "Laporan"}.pdf`;
  await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_SEKAWAN, documentName);
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
    const success = await sendPDFToTelegram(pdfUri, TELEGRAM_CHAT_ID_SEKAWAN, documentName);

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
 */
export async function sendWholesaleSaleToTelegram(
  receiptData: ReceiptData,
  format: "A4" | "A6" = "A4",
  invoiceNo: number
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
      const pdfUri = await shareReceiptAsPDF(receiptData, "wholesale", "A4");
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

    // Generate payment receipt HTML
    const paymentReceiptHTML = generatePaymentReceiptHTML(paymentData);

    // Generate PDF from HTML using the same method as receipts
    const pdfUri = await generatePDFFromHTML(paymentReceiptHTML, 80);

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
