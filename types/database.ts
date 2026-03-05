// Database types for Supabase tables

export type UserRole = "admin" | "cashier" | "manager";

export interface UserProfile {
  id: string; // UUID, matches auth.users.id
  created_at: string;
  updated_at: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface Category {
  id: string; // uuid
  created_at: string; // timestamptz
  title: string; // varchar
}

export interface SystemData {
  id: string; // varchar
  created_at: string; // timestamptz
  grosirInvoiceNo: number; // int8
}

export interface Barang {
  id: string; // varchar
  createdAt: string; // timestamp
  createdBy: string; // text
  barangNama: string; // varchar
  barangType: string; // text
  barangUnit: string; // text
  barangHarga: number; // int4
  barangModal: number; // int4
  barangGrosir: number; // int4
  barangBon: number; // int4
  barangNote: string | null; // varchar
  stockBarang: number; // int4
  stockTokoMini: number; // int4
}

export interface JualanKontan {
  id: string; // text
  created_at: string; // timestamptz
  created_atIndo: string; // text
  totalBelanja: number; // numeric
  namaKasir: string; // varchar
  caraPembayaran: string; // varchar
  userId?: string; // UUID reference to userProfiles
}

export interface PaymentRecord {
  date: string; // ISO date string
  amount: number;
  paymentMethod: string;
  createdBy: string; // kasir name
}

export type GrosirPaymentStatus = "unpaid" | "partially_paid" | "paid";

export interface GrosirPayment {
  id: string; // uuid
  created_at: string; // timestamptz — payment received date
  jualanGrosirId: string; // uuid
  amount: number; // float8
  paymentMethod: string; // text
  createdBy: string; // text
  userId?: string; // uuid, optional
}

export interface JualanGrosir {
  id: string; // uuid
  created_at: string; // timestamptz
  created_atIndo: string; // text
  invoiceNo: number; // int8
  namaPelanggan: string; // text
  totalBelanja: number; // float8
  setorGrosir: number; // float8
  sisaBonGrosir: number; // int8
  namaKasir: string; // text
  caraPembayaran: string; // text
  paymentHistory?: PaymentRecord[]; // jsonb array (legacy; grosirPayments is source of truth)
  userId?: string; // UUID reference to userProfiles
  payment_status?: GrosirPaymentStatus; // unpaid | partially_paid | paid
  percent_paid?: number; // 0–100
}

// Cart item for sales
export interface CartItem {
  barang: Barang;
  quantity: number;
  price: number; // Can be different from barangHarga for discounts
}

// Sales transaction (before saving)
export interface SaleTransaction {
  items: CartItem[];
  total: number;
  paymentMethod: string;
  cashierName: string;
  customerName?: string; // For wholesale
  isWholesale: boolean;
}

// Saved grosir draft (saved transaction to continue later)
export interface GrosirDraft {
  id: string;
  created_at: string;
  updated_at: string;
  createdBy: string | null;
  namaPelanggan: string;
  totalBelanja: number;
  setorAwal: number;
  status: string;
}

// Line item for a grosir draft
export interface GrosirDraftItem {
  id: string;
  grosirDraftId: string;
  barangId: string;
  barangNama: string;
  barangUnit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Sale item record (stored in jualanItems table)
// Note: Column names use mixed case to match the actual database schema
export interface JualanItem {
  id: string; // uuid
  created_at: string; // timestamptz
  jualanKontanId: string | null; // text, nullable
  jualanGrosirId: string | null; // uuid, nullable
  barangId: string; // varchar
  barangNama: string; // varchar - snapshot at time of sale
  quantity: number; // int4
  unitPrice: number; // int4 - snapshot at time of sale
  totalPrice: number; // int4 - quantity × unitPrice
  barangUnit: string; // text - snapshot at time of sale
}
