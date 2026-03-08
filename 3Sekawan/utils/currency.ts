/**
 * Currency formatting utilities for Indonesian Rupiah (IDR)
 */

/**
 * Format a number as Indonesian Rupiah
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the Rp symbol (default: true)
 * @returns Formatted currency string (e.g., "Rp 1.234.567" or "1.234.567")
 */
export function formatIDR(amount: number, showSymbol: boolean = true): string {
  // Convert to integer if it's a decimal
  const integerAmount = Math.round(amount);
  
  // Format with thousand separators (dots)
  const formatted = integerAmount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return showSymbol ? `Rp ${formatted}` : formatted;
}

/**
 * Parse a formatted IDR string back to a number
 * @param formatted - Formatted currency string (e.g., "Rp 1.234.567")
 * @returns The numeric value
 */
export function parseIDR(formatted: string): number {
  // Remove Rp symbol and dots
  const cleaned = formatted.replace(/Rp\s?/g, '').replace(/\./g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Format currency using Intl.NumberFormat (alternative method)
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
export function formatIDRIntl(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

