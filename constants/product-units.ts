/**
 * Product unit constants
 * Common units used in Indonesian supermarkets
 */

export const PRODUCT_UNITS = [
  { value: 'Pcs', label: 'Pcs (Piece)' },
  { value: 'Dus', label: 'Dus (Box)' },
  { value: 'Slp', label: 'Slp (Pack)' },
  { value: 'Sak', label: 'Sak (Sack)' },
  { value: 'Bks', label: 'Bks (Pack)' },
  { value: 'Btl', label: 'Btl (Bottle)' },
  { value: 'Box', label: 'Box' },
  { value: 'Kg', label: 'Kg (Kilogram)' },
  { value: 'Gr', label: 'Gr (Gram)' },
  { value: 'L', label: 'L (Liter)' },
  { value: 'Ml', label: 'Ml (Milliliter)' },
  { value: 'M', label: 'M (Meter)' },
  { value: 'Cm', label: 'Cm (Centimeter)' },
] as const;

export type ProductUnit = typeof PRODUCT_UNITS[number]['value'];

