/**
 * Database service layer – Neon only. Set EXPO_PUBLIC_NEON_DATA_API_URL (direct) or EXPO_PUBLIC_API_URL (backend).
 */

import { getCurrentNeonUserId } from "@/lib/neonAuthClient";
import type {
  Barang,
  CartItem,
  Category,
  GrosirDraft,
  GrosirDraftItem,
  GrosirPayment,
  GrosirPaymentStatus,
  JualanGrosir,
  JualanItem,
  JualanKontan,
  PaymentRecord,
  SystemData,
  UserProfile,
  UserRole,
} from "@/edysonpos/types/database";
import { getCurrentDateTimeIndo } from "@/utils/date";
import * as neonApi from "./neonApiClient";
import * as neonData from "./neonDataApiClient";

/** Re-export so UI can catch 401/403 and e.g. redirect to login. */
export { NeonDataApiError } from "./neonDataApiClient";

const USE_NEON_DATA_API = neonData.isNeonDataApiEnabled();
const USE_NEON_API = !USE_NEON_DATA_API && neonApi.isNeonApiEnabled();
const USE_NEON = USE_NEON_DATA_API || USE_NEON_API;

const NEON_REQUIRED_MSG =
  "Neon database is required. Set EXPO_PUBLIC_NEON_DATA_API_URL (direct) or EXPO_PUBLIC_API_URL (backend) in .env";

function requireNeon(): void {
  if (!USE_NEON) throw new Error(NEON_REQUIRED_MSG);
}

function neon(): typeof neonApi {
  return USE_NEON_DATA_API ? (neonData as unknown as typeof neonApi) : neonApi;
}

// Categories
export async function getCategories(): Promise<Category[]> {
  requireNeon();
  return neon().neonGetCategories() as Promise<Category[]>;
}

export async function createCategory(title: string): Promise<Category> {
  requireNeon();
  return neon().neonCreateCategory(title) as Promise<Category>;
}

// System Data
export async function getSystemData(): Promise<SystemData | null> {
  requireNeon();
  return neon().neonGetSystemData() as Promise<SystemData | null>;
}

export async function getNextGrosirInvoiceNo(): Promise<number> {
  requireNeon();
  return neon().neonGetNextGrosirInvoiceNo();
}

// Products (Barangs)
export async function getBarangs(): Promise<Barang[]> {
  requireNeon();
  return neon().neonGetBarangs() as Promise<Barang[]>;
}

export async function getBarangById(id: string): Promise<Barang | null> {
  requireNeon();
  return neon().neonGetBarangById(id) as Promise<Barang | null>;
}

export async function getBarangByBarcode(barcode: string): Promise<Barang | null> {
  if (!barcode || !barcode.trim()) {
    console.warn("Empty barcode provided");
    return null;
  }
  const trimmedBarcode = barcode.trim().toUpperCase();
  console.log("Fetching barang with barcode:", trimmedBarcode);
  requireNeon();
  return neon().neonGetBarangById(trimmedBarcode) as Promise<Barang | null>;
}

export async function updateBarangStock(
  id: string,
  stockBarang: number,
  stockTokoMini?: number
): Promise<void> {
  requireNeon();
  await neon().neonUpdateBarangStock(id, stockBarang, stockTokoMini);
}

export async function createBarang(
  id: string, // barcode
  barangNama: string,
  barangUnit: string,
  barangHarga: number,
  barangGrosir: number,
  barangBon: number,
  barangModal: number,
  barangType: string,
  barangNote: string | null,
  stockBarang: number,
  stockTokoMini: number,
  createdBy: string = "system"
): Promise<Barang> {
  requireNeon();
  return neon().neonCreateBarang({
    id: id.toUpperCase(),
    barangNama: barangNama.toUpperCase(),
    barangUnit,
    barangHarga,
    barangGrosir,
    barangBon,
    barangModal,
    barangType,
    barangNote: barangNote || null,
    stockBarang,
    stockTokoMini,
    createdBy,
  }) as Promise<Barang>;
}

export async function updateBarang(
  id: string,
  updates: {
    barangNama?: string;
    barangUnit?: string;
    barangHarga?: number;
    barangGrosir?: number;
    barangBon?: number;
    barangModal?: number;
    barangType?: string;
    barangNote?: string | null;
    stockBarang?: number;
    stockTokoMini?: number;
  }
): Promise<Barang> {
  const updateData: any = {};
  if (updates.barangNama !== undefined) updateData.barangNama = updates.barangNama.toUpperCase();
  if (updates.barangUnit !== undefined) updateData.barangUnit = updates.barangUnit;
  if (updates.barangHarga !== undefined) updateData.barangHarga = updates.barangHarga;
  if (updates.barangGrosir !== undefined) updateData.barangGrosir = updates.barangGrosir;
  if (updates.barangBon !== undefined) updateData.barangBon = updates.barangBon;
  if (updates.barangModal !== undefined) updateData.barangModal = updates.barangModal;
  if (updates.barangType !== undefined) updateData.barangType = updates.barangType;
  if (updates.barangNote !== undefined) updateData.barangNote = updates.barangNote;
  if (updates.stockBarang !== undefined) updateData.stockBarang = updates.stockBarang;
  if (updates.stockTokoMini !== undefined) updateData.stockTokoMini = updates.stockTokoMini;
  requireNeon();
  return neon().neonUpdateBarang(id, updateData) as Promise<Barang>;
}

export async function deleteBarang(id: string): Promise<void> {
  requireNeon();
  await neon().neonDeleteBarang(id);
}

// User Profiles
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  requireNeon();
  return neon().neonGetUserProfile(userId) as Promise<UserProfile | null>;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const userId = await getCurrentNeonUserId();
  if (!userId) return null;
  return getUserProfile(userId);
}

export async function createUserProfile(data: {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
}): Promise<UserProfile> {
  requireNeon();
  return neon().neonCreateUserProfile(data) as Promise<UserProfile>;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, "fullName" | "phone" | "role" | "isActive" | "lastLoginAt">>
): Promise<UserProfile> {
  requireNeon();
  return neon().neonUpdateUserProfile(userId, updates) as Promise<UserProfile>;
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  requireNeon();
  return neon().neonGetAllUserProfiles() as Promise<UserProfile[]>;
}

export async function getUsersWithoutProfiles(): Promise<
  Array<{ id: string; email: string; created_at: string }>
> {
  requireNeon();
  return neon().neonGetUsersWithoutProfiles();
}

// Sales - Cash (Jualan Kontan)
export async function createJualanKontan(
  totalBelanja: number,
  namaKasir: string,
  caraPembayaran: string,
  items: CartItem[] = [],
  userId?: string
): Promise<JualanKontan> {
  requireNeon();
  const id = Date.now().toString();
  const data = await neon().neonCreateJualanKontan({
    id,
    totalBelanja,
    namaKasir,
    caraPembayaran,
    created_atIndo: getCurrentDateTimeIndo(),
    userId: userId || null,
  }) as JualanKontan;
  if (items.length > 0) {
    try {
      await createJualanItems(items, id, undefined);
    } catch (itemsError) {
      console.error("Error creating sale items, but sale was created:", itemsError);
    }
  }
  return data;
}

export async function getJualanKontanToday(): Promise<JualanKontan[]> {
  requireNeon();
  return neon().neonGetJualanKontanToday() as Promise<JualanKontan[]>;
}

export async function getAllJualanKontan(): Promise<JualanKontan[]> {
  requireNeon();
  return neon().neonGetAllJualanKontan() as Promise<JualanKontan[]>;
}

export async function getJualanKontanByDateRange(
  startDate: Date,
  endDate?: Date,
  userId?: string
): Promise<JualanKontan[]> {
  const end = endDate || new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  requireNeon();
  return neon().neonGetJualanKontanByDateRange(start.toISOString(), end.toISOString(), userId) as Promise<JualanKontan[]>;
}

// Helper: compute payment_status and percent_paid from setor and total
function getGrosirPaymentStatus(
  setorGrosir: number,
  totalBelanja: number
): { payment_status: GrosirPaymentStatus; percent_paid: number } {
  if (totalBelanja <= 0) return { payment_status: "unpaid", percent_paid: 0 };
  const percent_paid = Math.min(100, Math.round((setorGrosir / totalBelanja) * 100 * 100) / 100);
  const payment_status: GrosirPaymentStatus =
    percent_paid >= 100 ? "paid" : setorGrosir > 0 ? "partially_paid" : "unpaid";
  return { payment_status, percent_paid };
}

// Grosir payments table (source of truth for payment records)
export async function insertGrosirPayment(
  jualanGrosirId: string,
  amount: number,
  paymentMethod: string,
  createdBy: string,
  paidAt?: Date,
  userId?: string
): Promise<GrosirPayment> {
  requireNeon();
  return neon().neonInsertGrosirPayment({
    jualanGrosirId,
    amount,
    paymentMethod,
    createdBy,
    userId: userId || null,
  }) as Promise<GrosirPayment>;
}

export async function getGrosirPaymentsByJualanGrosirId(
  jualanGrosirId: string
): Promise<GrosirPayment[]> {
  requireNeon();
  return neon().neonGetGrosirPaymentsByJualanGrosirId(jualanGrosirId) as Promise<GrosirPayment[]>;
}

export async function getGrosirPaymentsByDateRange(
  startDate: Date,
  endDate?: Date
): Promise<GrosirPayment[]> {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  requireNeon();
  return neon().neonGetGrosirPaymentsByDateRange(start.toISOString(), end.toISOString()) as Promise<GrosirPayment[]>;
}

// Sales - Wholesale (Jualan Grosir)
export async function createJualanGrosir(
  namaPelanggan: string,
  totalBelanja: number,
  setorGrosir: number,
  sisaBonGrosir: number,
  namaKasir: string,
  caraPembayaran: string,
  items: CartItem[] = [],
  userId?: string
): Promise<JualanGrosir> {
  requireNeon();
  const invoiceNo = await getNextGrosirInvoiceNo();
  const initialPaymentHistory: PaymentRecord[] =
    setorGrosir > 0 ? [{ date: new Date().toISOString(), amount: setorGrosir, paymentMethod: caraPembayaran, createdBy: namaKasir }] : [];
  const { payment_status, percent_paid } = getGrosirPaymentStatus(setorGrosir, totalBelanja);
  const saleData = await neon().neonCreateJualanGrosir({
    invoiceNo,
    namaPelanggan: namaPelanggan ?? "",
    totalBelanja,
    setorGrosir,
    sisaBonGrosir,
    namaKasir,
    caraPembayaran: caraPembayaran ?? "",
    created_atIndo: getCurrentDateTimeIndo(),
    paymentHistory: initialPaymentHistory,
    payment_status,
    percent_paid,
    userId: userId ?? null,
  }) as JualanGrosir;
  if (setorGrosir > 0) {
    try {
      await insertGrosirPayment(saleData.id, setorGrosir, caraPembayaran, namaKasir, undefined, userId);
    } catch (e) {
      console.warn("Neon: initial grosir payment failed", e);
    }
  }
  if (items.length > 0) {
    try {
      await createJualanItems(items, undefined, saleData.id);
    } catch (itemsError) {
      console.error("Error creating sale items for jualanGrosir:", itemsError);
      try {
        await neon().neonDeleteJualanGrosir(saleData.id);
      } catch (cleanupError) {
        console.error("Rollback failed for jualanGrosir:", cleanupError);
      }
      throw itemsError;
    }
  } else {
    await neon().neonDeleteJualanGrosir(saleData.id);
    throw new Error("Cannot complete wholesale sale without items.");
  }
  return saleData;
}

export async function getJualanGrosirToday(): Promise<JualanGrosir[]> {
  requireNeon();
  return neon().neonGetJualanGrosirToday() as Promise<JualanGrosir[]>;
}

export async function getAllJualanGrosir(): Promise<JualanGrosir[]> {
  requireNeon();
  return neon().neonGetAllJualanGrosir() as Promise<JualanGrosir[]>;
}

export async function getJualanGrosirByDateRange(
  startDate: Date,
  endDate?: Date,
  userId?: string
): Promise<JualanGrosir[]> {
  const end = endDate || new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  requireNeon();
  return neon().neonGetJualanGrosirByDateRange(start.toISOString(), end.toISOString(), userId) as Promise<JualanGrosir[]>;
}

// Sale Items (Jualan Items)
async function ensureBarangsExistForCartItems(items: CartItem[]): Promise<void> {
  requireNeon();
  const uniqueIds = Array.from(
    new Set(
      items
        .map((i) => i?.barang?.id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim().toUpperCase())
    )
  );
  if (uniqueIds.length === 0) return;
  const all = await neon().neonGetBarangs();
  const existingIds = new Set((all || []).map((r: any) => String(r.id).toUpperCase()));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
  for (const id of missingIds) {
    const sourceItem = items.find((it) => it?.barang?.id?.trim().toUpperCase() === id);
    const barang = sourceItem?.barang;
    const fallbackName = barang?.barangNama || "MANUAL ITEM";
    await neon().neonCreateBarang({
      id,
      createdBy: barang?.createdBy || "system",
      barangNama: String(fallbackName).toUpperCase(),
      barangType: barang?.barangType || "Manual",
      barangUnit: barang?.barangUnit || "Pcs",
      barangHarga: typeof barang?.barangHarga === "number" ? barang.barangHarga : sourceItem?.price || 0,
      barangModal: typeof barang?.barangModal === "number" ? barang.barangModal : 0,
      barangGrosir: typeof barang?.barangGrosir === "number" ? barang.barangGrosir : sourceItem?.price || 0,
      barangBon: typeof barang?.barangBon === "number" ? barang.barangBon : 0,
      barangNote: barang?.barangNote ?? "Auto-created for manual sale item",
      stockBarang: typeof barang?.stockBarang === "number" ? barang.stockBarang : 0,
      stockTokoMini: typeof barang?.stockTokoMini === "number" ? barang.stockTokoMini : 0,
    });
  }
}

export async function createJualanItems(
  items: CartItem[],
  jualanKontanId?: string,
  jualanGrosirId?: string
): Promise<JualanItem[]> {
  if (!jualanKontanId && !jualanGrosirId) {
    throw new Error("Either jualanKontanId or jualanGrosirId must be provided");
  }
  await ensureBarangsExistForCartItems(items);
  const itemsToInsert = items.map((item) => ({
    jualanKontanId: jualanKontanId || null,
    jualanGrosirId: jualanGrosirId || null,
    barangId: item.barang.id.trim().toUpperCase(),
    barangNama: item.barang.barangNama,
    quantity: item.quantity,
    unitPrice: item.price,
    totalPrice: item.price * item.quantity,
    barangUnit: item.barang.barangUnit,
  }));
  requireNeon();
  const inserted = await neon().neonCreateJualanItems(itemsToInsert);
  return (inserted || []) as JualanItem[];
}

export async function getJualanItemsByKontanId(jualanKontanId: string): Promise<JualanItem[]> {
  requireNeon();
  return neon().neonGetJualanItemsByKontanId(jualanKontanId) as Promise<JualanItem[]>;
}

export async function getJualanItemsByGrosirId(jualanGrosirId: string): Promise<JualanItem[]> {
  requireNeon();
  return neon().neonGetJualanItemsByGrosirId(jualanGrosirId) as Promise<JualanItem[]>;
}

/** Get all sale items for a product (purchase history). Neon only; returns [] if not implemented. */
export async function getJualanItemsByBarangId(barangId: string): Promise<JualanItem[]> {
  requireNeon();
  return [];
}

/**
 * Add a payment record: insert into grosirPayments and update jualanGrosir
 */
export async function addGrosirPayment(
  jualanGrosirId: string,
  payment: PaymentRecord,
  userId?: string
): Promise<JualanGrosir> {
  requireNeon();
  const paidAt = payment.date ? new Date(payment.date) : undefined;
  await insertGrosirPayment(
    jualanGrosirId,
    payment.amount,
    payment.paymentMethod,
    payment.createdBy,
    paidAt,
    userId
  );
  const sale = await neon().neonGetJualanGrosirById(jualanGrosirId) as JualanGrosir;
  if (!sale) throw new Error("Sale not found");
  const existingPayments: PaymentRecord[] = sale.paymentHistory || [];
  const updatedPayments = [...existingPayments, payment];
  const newSetorGrosir = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
  const newSisaBonGrosir = sale.totalBelanja - newSetorGrosir;
  const { payment_status, percent_paid } = getGrosirPaymentStatus(newSetorGrosir, sale.totalBelanja);
  const updated = await neon().neonUpdateJualanGrosir(jualanGrosirId, {
    paymentHistory: updatedPayments,
    setorGrosir: newSetorGrosir,
    sisaBonGrosir: newSisaBonGrosir,
    payment_status,
    percent_paid,
  }) as JualanGrosir;
  return updated;
}

// Grosir drafts (saved transactions)
export async function createGrosirDraft(
  namaPelanggan: string,
  totalBelanja: number,
  setorAwal: number,
  items: CartItem[],
  userId?: string
): Promise<GrosirDraft> {
  await ensureBarangsExistForCartItems(items);
  requireNeon();
  const draft = await neon().neonCreateGrosirDraft({
    createdBy: userId ?? null,
    namaPelanggan: namaPelanggan || "",
    totalBelanja,
    setorAwal: setorAwal || 0,
    items: items.map((item) => ({
      barangId: item.barang.id,
      barangNama: item.barang.barangNama,
      barangUnit: item.barang.barangUnit || "Pcs",
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    })),
  }) as GrosirDraft;
  return draft;
}

export async function updateGrosirDraft(
  draftId: string,
  namaPelanggan: string,
  totalBelanja: number,
  setorAwal: number,
  items: CartItem[]
): Promise<GrosirDraft> {
  await ensureBarangsExistForCartItems(items);
  requireNeon();
  const updated = await neon().neonUpdateGrosirDraft(draftId, {
    namaPelanggan: namaPelanggan || "",
    totalBelanja,
    setorAwal: setorAwal || 0,
    items: items.map((item) => ({
      barangId: item.barang.id,
      barangNama: item.barang.barangNama,
      barangUnit: item.barang.barangUnit || "Pcs",
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    })),
  }) as GrosirDraft;
  return updated;
}

export async function getGrosirDrafts(userId?: string): Promise<GrosirDraft[]> {
  requireNeon();
  return neon().neonGetGrosirDrafts(userId) as Promise<GrosirDraft[]>;
}

export async function getGrosirDraftById(id: string): Promise<GrosirDraft | null> {
  requireNeon();
  return neon().neonGetGrosirDraftById(id) as Promise<GrosirDraft | null>;
}

export async function getGrosirDraftItems(draftId: string): Promise<GrosirDraftItem[]> {
  requireNeon();
  return neon().neonGetGrosirDraftItems(draftId) as Promise<GrosirDraftItem[]>;
}

export async function deleteGrosirDraft(id: string): Promise<void> {
  requireNeon();
  await neon().neonDeleteGrosirDraft(id);
}
