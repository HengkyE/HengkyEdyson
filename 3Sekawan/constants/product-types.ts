/**
 * Product type/category constants
 * Common product categories for Indonesian supermarkets
 */

export const PRODUCT_TYPES = [
  { value: 'Makanan', label: 'Makanan (Food)' },
  { value: 'Minuman', label: 'Minuman (Beverage)' },
  { value: 'Snack', label: 'Snack' },
  { value: 'Sembako', label: 'Sembako (Basic Needs)' },
  { value: 'Pembersih', label: 'Pembersih (Cleaning)' },
  { value: 'Perawatan', label: 'Perawatan (Personal Care)' },
  { value: 'Elektronik', label: 'Elektronik (Electronics)' },
  { value: 'Pakaian', label: 'Pakaian (Clothing)' },
  { value: 'Alat Tulis', label: 'Alat Tulis (Stationery)' },
  { value: 'Mainan', label: 'Mainan (Toys)' },
  { value: 'Lainnya', label: 'Lainnya (Others)' },
] as const;

export type ProductType = typeof PRODUCT_TYPES[number]['value'];

