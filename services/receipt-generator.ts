/**
 * Receipt generation service
 * Uses expo-print to generate and print receipts
 * On web, uses html2canvas to avoid print dialog
 */

import {
  generateCashReceiptHTML,
  generateWholesaleReceiptHTML,
  type ReceiptData,
} from "@/utils/receipt-formatter";
import * as Print from "expo-print";
import { Platform } from "react-native";

/**
 * For web: when HTML is a full document (<html>...</html>), innerHTML on a div
 * does not apply <head> styles. Extract styles and body content so the PDF renders correctly.
 */
function getHtmlFragmentForWebCapture(html: string): string {
  const trimmed = html.trim();
  const lower = trimmed.toLowerCase();
  const isFullDocument =
    lower.startsWith("<!doctype") || lower.startsWith("<html");
  if (typeof document === "undefined" || !isFullDocument) {
    return html;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const bodyContent = doc.body?.innerHTML ?? "";
    const styleElements = doc.querySelectorAll("style");
    const styles = Array.from(styleElements)
      .map((el) => el.innerHTML)
      .join("\n");
    // Apply body styles to a wrapper so layout/typography are preserved
    const wrappedStyles = styles.replace(
      /\bbody\b/g,
      ".receipt-pdf-wrapper"
    );
    return `<style>${wrappedStyles}</style><div class="receipt-pdf-wrapper">${bodyContent}</div>`;
  } catch (e) {
    console.warn("Could not parse receipt HTML for web capture, using raw HTML:", e);
    return html;
  }
}

/**
 * Create a valid PDF from a JPEG image data URL
 * Returns a Uint8Array to properly handle binary data
 */
function createSimplePDFFromImage(
  imageDataUrl: string,
  widthMm: number,
  imageWidth: number,
  imageHeight: number
): Uint8Array {
  // Remove data URL prefix (data:image/jpeg;base64,)
  const base64Image = imageDataUrl.split(",")[1];

  // Decode base64 to binary bytes
  const binaryImage = atob(base64Image);
  const imageLength = binaryImage.length;

  // Convert binary string to Uint8Array
  const imageBytes = new Uint8Array(imageLength);
  for (let i = 0; i < imageLength; i++) {
    imageBytes[i] = binaryImage.charCodeAt(i);
  }

  // Calculate dimensions in points (1mm = 2.83465 points)
  const widthPt = widthMm * 2.83465;
  const aspectRatio = imageHeight / imageWidth;
  const heightPt = widthPt * aspectRatio;

  // Helper to convert string to bytes
  const strToBytes = (str: string): Uint8Array => {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  };

  // Helper to concatenate Uint8Arrays
  const concatArrays = (...arrays: Uint8Array[]): Uint8Array => {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  };

  // Build PDF parts
  const pdfHeader = strToBytes("%PDF-1.4\n");

  // Object 1: Catalog
  const obj1 = strToBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Object 2: Pages
  const obj2 = strToBytes("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // Object 3: Page
  const obj3 = strToBytes(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R\n/MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(
      2
    )}]\n/Resources << /XObject << /Im1 4 0 R >> >>\n/Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: Image XObject (JPEG with DCTDecode)
  const obj4Header = strToBytes(
    `4 0 obj\n<< /Type /XObject /Subtype /Image\n/Width ${imageWidth} /Height ${imageHeight}\n/ColorSpace /DeviceRGB /BitsPerComponent 8\n/Filter /DCTDecode\n/Length ${imageLength} >>\nstream\n`
  );
  const obj4Footer = strToBytes("\nendstream\nendobj\n");
  const obj4 = concatArrays(obj4Header, imageBytes, obj4Footer);

  // Object 5: Contents
  const contents = `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im1 Do\nQ`;
  const contentsBytes = strToBytes(contents);
  const obj5Header = strToBytes(`5 0 obj\n<< /Length ${contentsBytes.length} >>\nstream\n`);
  const obj5Footer = strToBytes(`\nendstream\nendobj\n`);
  const obj5 = concatArrays(obj5Header, contentsBytes, obj5Footer);

  // Calculate offsets (from start of PDF file)
  let offset = pdfHeader.length;
  const offsets: number[] = [];

  // Object 1 offset
  offsets.push(offset);
  offset += obj1.length;

  // Object 2 offset
  offsets.push(offset);
  offset += obj2.length;

  // Object 3 offset
  offsets.push(offset);
  offset += obj3.length;

  // Object 4 offset
  offsets.push(offset);
  offset += obj4.length;

  // Object 5 offset
  offsets.push(offset);
  offset += obj5.length;

  // Build PDF body
  const pdfBody = concatArrays(pdfHeader, obj1, obj2, obj3, obj4, obj5);

  // XRef table (object 0 is free, objects 1-5 are in use)
  let xrefStr = "xref\n";
  xrefStr += `0 ${offsets.length + 1}\n`; // Total: 6 entries (0-5)
  xrefStr += "0000000000 65535 f \n"; // Object 0: free
  for (const off of offsets) {
    xrefStr += off.toString().padStart(10, "0") + " 00000 n \n";
  }
  const xref = strToBytes(xrefStr);

  // Trailer
  const xrefStart = pdfBody.length;
  const trailer = strToBytes(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  // Combine all parts
  const finalPdf = concatArrays(pdfBody, xref, trailer);

  // Verify PDF structure
  const pdfStart = String.fromCharCode(...finalPdf.slice(0, 8));
  const pdfEnd = String.fromCharCode(...finalPdf.slice(-5));
  if (pdfStart !== "%PDF-1.4" || pdfEnd !== "%%EOF") {
    console.error("PDF structure validation failed:", { pdfStart, pdfEnd });
  }

  return finalPdf;
}

export interface PrintOptions {
  format?: "A4" | "A6" | "80mm";
  showPrintDialog?: boolean;
}

/**
 * Generate and print cash sale receipt
 * Uses the same PDF file that's sent to Telegram
 */
export async function printCashReceipt(
  data: ReceiptData,
  options: PrintOptions = {}
): Promise<void> {
  try {
    console.log("Generating PDF for printing...");
    // Generate PDF file first (same as Telegram)
    const pdfUri = await shareReceiptAsPDF(data, "cash", "A6");
    console.log("PDF generated for printing:", pdfUri);

    // Print the generated PDF file
    await Print.printAsync({
      uri: pdfUri,
    });
    console.log("PDF printed successfully");
  } catch (error) {
    console.error("Error printing cash receipt:", error);
    throw new Error("Failed to print receipt. Please try again.");
  }
}

/**
 * Generate and print wholesale sale receipt
 */
export async function printWholesaleReceipt(
  data: ReceiptData,
  format: "A4" | "A6" = "A6",
  options: PrintOptions = {}
): Promise<void> {
  try {
    const html = generateWholesaleReceiptHTML(data, format);

    await Print.printAsync({
      html,
      width: format === "A4" ? 210 : 80, // mm
      height: undefined, // Auto height
    });
  } catch (error) {
    console.error("Error printing wholesale receipt:", error);
    throw new Error("Failed to print receipt. Please try again.");
  }
}

/**
 * Generate receipt HTML without printing (for preview or sharing)
 */
export function generateReceiptHTML(
  data: ReceiptData,
  type: "cash" | "wholesale" = "cash",
  format: "A4" | "A6" = "A6"
): string {
  if (type === "cash") {
    return generateCashReceiptHTML(data);
  } else {
    return generateWholesaleReceiptHTML(data, format);
  }
}

/**
 * Share receipt as PDF (for email, messaging, etc.)
 * On web, generates a blob URL to avoid print dialog
 * On native, uses expo-print's printToFileAsync
 */
export async function shareReceiptAsPDF(
  data: ReceiptData,
  type: "cash" | "wholesale" = "cash",
  format: "A4" | "A6" = "A6",
  showWatermark: boolean = false,
  watermarkText: string = "TOKO EDYSON"
): Promise<string> {
  try {
    console.log("Generating receipt HTML...");
    const html =
      type === "cash"
        ? generateCashReceiptHTML(data, format, showWatermark, watermarkText)
        : generateWholesaleReceiptHTML(data, format, showWatermark, watermarkText);

    // Cash receipts: use A4 (210mm) when format is A4, otherwise 80mm
    // Wholesale uses A4 (210mm) or A6 (80mm) based on format
    const width = type === "cash" ? (format === "A4" ? 210 : 80) : format === "A4" ? 210 : 80;
    // A4 height is 297mm
    const height = format === "A4" ? 297 : undefined;
    console.log("PDF width:", width, "mm", "height:", height || "auto", "mm");
    console.log("Platform:", Platform.OS);

    // On web, expo-print's printToFileAsync doesn't work.
    // Use html2canvas to convert HTML to image, then create PDF manually.
    if (Platform.OS === "web") {
      console.log("Creating PDF file on web (html2canvas)...");

      // Use html2canvas only (no jsPDF) to convert HTML to image, then create PDF manually
      // This avoids jsPDF's dynamic require issue
      // Import only html2canvas (avoid jsPDF's import issues)
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default || html2canvasModule;

      // Create a temporary element with the HTML.
      // Full-document HTML (e.g. wholesale A4) must be converted to a fragment with
      // styles inlined so that innerHTML actually applies CSS (browsers drop <head> in a div).
      const fragment = getHtmlFragmentForWebCapture(html);
      const element = document.createElement("div");
      element.innerHTML = fragment;
      // For A4, set proper page width. Height is dynamic (receipt can be long).
      if (format === "A4") {
        element.style.width = "210mm";
        // Add padding to simulate print margins (extra right padding to prevent cutoff)
        element.style.padding = "0 10.5mm";
        element.style.boxSizing = "border-box";
        element.style.overflow = "visible";
      } else {
        // For A6 (80mm width), add 5% margins (4mm on each side)
        element.style.width = `${width}mm`;
        element.style.padding = "0 4mm";
        element.style.boxSizing = "border-box";
      }
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "0";
      element.style.backgroundColor = "#fff";
      document.body.appendChild(element);

      try {
        // Use scroll dimensions to capture full content (prevents right-side cutoff)
        const scale = format === "A4" ? 1.25 : 2;
        const captureWidth = Math.max(element.scrollWidth, element.offsetWidth);
        const captureHeight = Math.max(element.scrollHeight, element.offsetHeight);
        const canvas = await html2canvas(element, {
          scale,
          width: captureWidth,
          height: captureHeight,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        // Convert canvas to JPEG data URL (JPEG works better in PDF)
        const imgData = canvas.toDataURL("image/jpeg", format === "A4" ? 0.85 : 0.95);

        // Create a valid PDF using proper structure (returns Uint8Array)
        // For A4, use A4 dimensions
        const pdfWidth = format === "A4" ? 210 : width;
        const pdfBytes = createSimplePDFFromImage(imgData, pdfWidth, canvas.width, canvas.height);

        const pdfBlob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(pdfBlob);

        // Clean up
        document.body.removeChild(element);

        console.log("PDF created successfully at:", blobUrl);
        return blobUrl;
      } catch (error) {
        // Clean up on error
        if (document.body.contains(element)) {
          document.body.removeChild(element);
        }
        throw error;
      }
    } else {
      // Native: use expo-print's printToFileAsync normally
      console.log("Creating PDF file on native using expo-print...");
      const result = await Print.printToFileAsync({
        html,
        base64: false,
        width,
        height,
      });
      const uri = result?.uri;
      if (!uri) {
        throw new Error("printToFileAsync did not return a URI");
      }
      console.log("PDF created successfully at:", uri);
      return uri;
    }
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    throw new Error("Failed to generate receipt PDF.");
  }
}

/**
 * Generate PDF from HTML string (for payment receipts)
 * @param html - HTML string to convert to PDF
 * @param widthMm - Width in millimeters (default: 80mm for A6)
 */
export async function generatePDFFromHTML(html: string, widthMm: number = 80): Promise<string> {
  try {
    console.log("Generating PDF from HTML...");
    console.log("PDF width:", widthMm, "mm");
    console.log("Platform:", Platform.OS);

    // On web, use html2canvas to convert HTML to image, then create PDF manually
    if (Platform.OS === "web") {
      console.log("Creating PDF file on web using html2canvas...");

      // Import html2canvas
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default || html2canvasModule;

      // Create a temporary element with the HTML (use fragment so full-document HTML keeps styles)
      const fragment = getHtmlFragmentForWebCapture(html);
      const element = document.createElement("div");
      element.innerHTML = fragment;
      element.style.width = `${widthMm}mm`;
      element.style.padding = "0 4mm";
      element.style.boxSizing = "border-box";
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "0";
      element.style.backgroundColor = "#fff";
      document.body.appendChild(element);

      try {
        // Convert HTML to canvas
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        // Remove temporary element
        document.body.removeChild(element);

        // Convert canvas to image data URL
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.95);

        // Create PDF from image
        const pdfBytes = createSimplePDFFromImage(
          imageDataUrl,
          widthMm,
          canvas.width,
          canvas.height
        );

        // Create blob URL
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const uri = URL.createObjectURL(blob);
        console.log("PDF created successfully at:", uri);
        return uri;
      } catch (canvasError) {
        document.body.removeChild(element);
        throw canvasError;
      }
    } else {
      // On native, use expo-print
      console.log("Creating PDF file on native using expo-print...");
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        width: widthMm,
      });
      console.log("PDF created successfully at:", uri);
      return uri;
    }
  } catch (error) {
    console.error("Error generating PDF from HTML:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    throw new Error("Failed to generate PDF from HTML.");
  }
}
