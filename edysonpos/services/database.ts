/**
 * Database service layer – uses Neon API when EXPO_PUBLIC_API_URL is set, else Supabase.
 */

import { getCurrentNeonUserId } from "@/lib/neonAuthClient";
import { supabase } from "@/lib/supabase";
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
import * as neon from "./neonApiClient";

const USE_NEON = neon.isNeonApiEnabled();

// Categories
export async function getCategories(): Promise<Category[]> {
  if (USE_NEON) return neon.neonGetCategories() as Promise<Category[]>;
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("title", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(title: string): Promise<Category> {
  if (USE_NEON) return neon.neonCreateCategory(title) as Promise<Category>;
  const { data, error } = await supabase
    .from("categories")
    .insert({ title } as any)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

// System Data
export async function getSystemData(): Promise<SystemData | null> {
  if (USE_NEON) return neon.neonGetSystemData() as Promise<SystemData | null>;
  const { data, error } = await supabase.from("systemData").select("*").limit(1).single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
  return data;
}

export async function getNextGrosirInvoiceNo(): Promise<number> {
  if (USE_NEON) return neon.neonGetNextGrosirInvoiceNo();
  // Check for existing system data with 'notaGrosir' ID (matching old system)
  const { data: existingData, error: fetchError } = await supabase
    .from("systemData")
    .select("*")
    .eq("id", "notaGrosir")
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  if (!existingData) {
    const { data, error } = await supabase
      .from("systemData")
      .insert({ id: "notaGrosir", grosirInvoiceNo: 1 } as any)
      .select()
      .single();

    if (error) throw error;
    return 1;
  }

  const nextNo = (existingData as any).grosirInvoiceNo + 1;
  const { error: updateError } = await supabase
    .from("systemData")
    .update({ grosirInvoiceNo: nextNo } as never)
    .eq("id", "notaGrosir");

  if (updateError) throw updateError;
  return nextNo;
}

// Products (Barangs)
export async function getBarangs(): Promise<Barang[]> {
  if (USE_NEON) return neon.neonGetBarangs() as Promise<Barang[]>;
  const { data, error, status, statusText } = await supabase
    .from("barangs")
    .select("*")
    .order("barangNama", { ascending: true });

  if (error) {
    console.error("Error fetching barangs:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status,
      statusText,
    });

    // Provide more helpful error messages
    if (error.code === "PGRST301" || status === 406) {
      const enhancedError = new Error(
        "Access denied. Please check Row Level Security (RLS) policies in Supabase. " +
          "The barangs table may need policies allowing SELECT for the anon role."
      );
      (enhancedError as any).code = error.code;
      (enhancedError as any).status = status;
      throw enhancedError;
    }

    throw error;
  }
  return data || [];
}

export async function getBarangById(id: string): Promise<Barang | null> {
  if (USE_NEON) return neon.neonGetBarangById(id) as Promise<Barang | null>;
  const { data, error } = await supabase.from("barangs").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching barang by id:", error);
    throw error;
  }
  return data;
}

export async function getBarangByBarcode(barcode: string): Promise<Barang | null> {
  if (!barcode || !barcode.trim()) {
    console.warn("Empty barcode provided");
    return null;
  }

  const trimmedBarcode = barcode.trim().toUpperCase();
  console.log("Fetching barang with barcode:", trimmedBarcode);

  if (USE_NEON) return neon.neonGetBarangById(trimmedBarcode) as Promise<Barang | null>;
  // Barcode is stored in the id field (varchar)
  const { data, error, status, statusText } = await supabase
    .from("barangs")
    .select("*")
    .eq("id", trimmedBarcode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - product doesn't exist
      console.log("No product found with barcode:", trimmedBarcode);
      return null;
    }

    console.error("Error fetching barang by barcode:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status,
      statusText,
    });

    // Provide more helpful error messages
    if (error.code === "PGRST301" || status === 406) {
      const enhancedError = new Error(
        "Access denied. Please check Row Level Security (RLS) policies in Supabase. " +
          "The barangs table may need policies allowing SELECT for authenticated users."
      );
      (enhancedError as any).code = error.code;
      (enhancedError as any).status = status;
      throw enhancedError;
    }

    throw error;
  }

  console.log("Successfully fetched barang:", (data as any)?.barangNama);
  return data as Barang;
}

export async function updateBarangStock(
  id: string,
  stockBarang: number,
  stockTokoMini?: number
): Promise<void> {
  if (USE_NEON) {
    await neon.neonUpdateBarangStock(id, stockBarang, stockTokoMini);
    return;
  }
  try {
    console.log(
      `Updating stock for barang ${id}: stockBarang=${stockBarang}, stockTokoMini=${stockTokoMini}`
    );
    const updateData: any = { stockBarang };
    if (stockTokoMini !== undefined) {
      updateData.stockTokoMini = stockTokoMini;
    }

    const { error } = await supabase
      .from("barangs")
      .update(updateData as never)
      .eq("id", id);

    if (error) {
      console.error(`Error updating stock for barang ${id}:`, error);
      throw error;
    }
    console.log(`Stock updated successfully for barang ${id}`);
  } catch (error) {
    console.error("updateBarangStock error:", error);
    throw error;
  }
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
  if (USE_NEON) {
    return neon.neonCreateBarang({
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
  const { data, error } = await supabase
    .from("barangs")
    .insert({
      id: id.toUpperCase(), // Barcode stored as id
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
      createdAt: new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Error creating barang:", error);
    throw error;
  }
  return data;
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

  if (USE_NEON) return neon.neonUpdateBarang(id, updateData) as Promise<Barang>;
  const { data, error } = await supabase
    .from("barangs")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating barang:", error);
    throw error;
  }
  return data;
}

export async function deleteBarang(id: string): Promise<void> {
  if (USE_NEON) {
    await neon.neonDeleteBarang(id);
    return;
  }
  const { error } = await supabase.from("barangs").delete().eq("id", id);

  if (error) {
    console.error("Error deleting barang:", error);
    throw error;
  }
}

// User Profiles
/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (USE_NEON) return neon.neonGetUserProfile(userId) as Promise<UserProfile | null>;
  const { data, error } = await supabase
    .from("userProfiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle null gracefully

  if (error) {
    // If it's a "not found" error, return null instead of throwing
    if (error.code === "PGRST116" || error.message?.includes("No rows")) {
      return null;
    }
    console.error("Error fetching user profile:", error);
    throw error;
  }
  return data ? (data as UserProfile) : null;
}

/**
 * Get current user profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (USE_NEON) {
    const userId = await getCurrentNeonUserId();
    if (!userId) return null;
    return getUserProfile(userId); // uses Neon API via getUserProfile
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserProfile(user.id); // uses Neon or Supabase via getUserProfile
}

/**
 * Create user profile (called after signup)
 */
export async function createUserProfile(data: {
  id: string; // auth.users.id
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
}): Promise<UserProfile> {
  if (USE_NEON) return neon.neonCreateUserProfile(data) as Promise<UserProfile>;
  const { data: profile, error } = await supabase
    .from("userProfiles")
    .insert({
      id: data.id,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone || null,
      role: data.role,
      isActive: true,
    } as never)
    .select()
    .single();

  if (error) throw error;
  return profile as UserProfile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, "fullName" | "phone" | "role" | "isActive" | "lastLoginAt">>
): Promise<UserProfile> {
  if (USE_NEON) return neon.neonUpdateUserProfile(userId, updates) as Promise<UserProfile>;
  const { data, error } = await supabase
    .from("userProfiles")
    .update(updates as never)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

/**
 * Get all user profiles (admin only)
 */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  if (USE_NEON) return neon.neonGetAllUserProfiles() as Promise<UserProfile[]>;
  const { data, error } = await supabase
    .from("userProfiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserProfile[];
}

/**
 * Get users without profiles (admin only)
 * Returns auth users who don't have a profile in userProfiles table
 */
export async function getUsersWithoutProfiles(): Promise<
  Array<{
    id: string;
    email: string;
    created_at: string;
  }>
> {
  if (USE_NEON) return neon.neonGetUsersWithoutProfiles();
  // Use RPC to call a database function that returns users without profiles
  const { data, error } = await supabase.rpc("get_users_without_profiles");

  if (error) {
    // If RPC function doesn't exist, fallback to empty array
    if (error.code === "42883" || error.message?.includes("function")) {
      console.warn("Database function get_users_without_profiles not found. Please create it.");
      return [];
    }
    throw error;
  }
  return data || [];
}

// Sales - Cash (Jualan Kontan)
export async function createJualanKontan(
  totalBelanja: number,
  namaKasir: string,
  caraPembayaran: string,
  items: CartItem[] = [],
  userId?: string
): Promise<JualanKontan> {
  try {
    const id = Date.now().toString();
    if (USE_NEON) {
      const data = await neon.neonCreateJualanKontan({
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
    const { data, error } = await supabase
      .from("jualanKontan")
      .insert({
        id,
        totalBelanja,
        namaKasir,
        caraPembayaran,
        created_atIndo: getCurrentDateTimeIndo(),
        userId: userId || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error creating jualanKontan:", error);
      throw error;
    }
    if (items.length > 0) {
      try {
        await createJualanItems(items, id, undefined);
      } catch (itemsError) {
        console.error("Error creating sale items, but sale was created:", itemsError);
      }
    }
    return data;
  } catch (error) {
    console.error("createJualanKontan error:", error);
    throw error;
  }
}

export async function getJualanKontanToday(): Promise<JualanKontan[]> {
  if (USE_NEON) return neon.neonGetJualanKontanToday() as Promise<JualanKontan[]>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("jualanKontan")
    .select("*")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllJualanKontan(): Promise<JualanKontan[]> {
  if (USE_NEON) return neon.neonGetAllJualanKontan() as Promise<JualanKontan[]>;
  const { data, error } = await supabase
    .from("jualanKontan")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Get cash sales within a date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive, defaults to today)
 */
export async function getJualanKontanByDateRange(
  startDate: Date,
  endDate?: Date,
  userId?: string
): Promise<JualanKontan[]> {
  const end = endDate || new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  if (USE_NEON) {
    return neon.neonGetJualanKontanByDateRange(start.toISOString(), end.toISOString(), userId) as Promise<JualanKontan[]>;
  }
  let query = supabase
    .from("jualanKontan")
    .select("*")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());
  if (userId) query = query.eq("userId", userId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
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
  if (USE_NEON) {
    return neon.neonInsertGrosirPayment({
      jualanGrosirId,
      amount,
      paymentMethod,
      createdBy,
      userId: userId || null,
    }) as Promise<GrosirPayment>;
  }
  const createdAt = paidAt ? paidAt.toISOString() : new Date().toISOString();
  const { data, error } = await supabase
    .from("grosirPayments")
    .insert({
      jualanGrosirId,
      amount,
      paymentMethod,
      createdBy,
      created_at: createdAt,
      userId: userId || null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as GrosirPayment;
}

export async function getGrosirPaymentsByJualanGrosirId(
  jualanGrosirId: string
): Promise<GrosirPayment[]> {
  if (USE_NEON) return neon.neonGetGrosirPaymentsByJualanGrosirId(jualanGrosirId) as Promise<GrosirPayment[]>;
  const { data, error } = await supabase
    .from("grosirPayments")
    .select("*")
    .eq("jualanGrosirId", jualanGrosirId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as GrosirPayment[];
}

export async function getGrosirPaymentsByDateRange(
  startDate: Date,
  endDate?: Date
): Promise<GrosirPayment[]> {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  if (USE_NEON) return neon.neonGetGrosirPaymentsByDateRange(start.toISOString(), end.toISOString()) as Promise<GrosirPayment[]>;
  const { data, error } = await supabase
    .from("grosirPayments")
    .select("*")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as GrosirPayment[];
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
  const invoiceNo = await getNextGrosirInvoiceNo();
  const initialPaymentHistory: PaymentRecord[] =
    setorGrosir > 0 ? [{ date: new Date().toISOString(), amount: setorGrosir, paymentMethod: caraPembayaran, createdBy: namaKasir }] : [];
  const { payment_status, percent_paid } = getGrosirPaymentStatus(setorGrosir, totalBelanja);

  if (USE_NEON) {
    const saleData = await neon.neonCreateJualanGrosir({
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
          await neon.neonDeleteJualanGrosir(saleData.id);
        } catch (cleanupError) {
          console.error("Rollback failed for jualanGrosir:", cleanupError);
        }
        throw itemsError;
      }
    } else {
      await neon.neonDeleteJualanGrosir(saleData.id);
      throw new Error("Cannot complete wholesale sale without items.");
    }
    return saleData;
  }

  const { data, error } = await supabase
    .from("jualanGrosir")
    .insert({
      invoiceNo,
      namaPelanggan,
      totalBelanja,
      setorGrosir,
      sisaBonGrosir,
      namaKasir,
      caraPembayaran,
      created_atIndo: getCurrentDateTimeIndo(),
      paymentHistory: initialPaymentHistory,
      payment_status,
      percent_paid,
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Error creating jualanGrosir:", error);
    throw error;
  }

  console.log("JualanGrosir created successfully:", data);

  const saleData = data as JualanGrosir;
  // Insert first payment into grosirPayments if setorGrosir > 0
  if (setorGrosir > 0 && saleData) {
    try {
      await insertGrosirPayment(
        saleData.id,
        setorGrosir,
        caraPembayaran,
        namaKasir,
        undefined,
        userId
      );
    } catch (payError) {
      console.error("Error inserting initial grosir payment:", payError);
      // Don't throw - sale was created successfully
    }
  }

  // Create sale items (REQUIRED)
  // If this fails, the transaction record becomes unprintable/unverifiable.
  // We'll attempt a best-effort rollback of the wholesale sale record.
  if (items.length > 0 && saleData) {
    try {
      await createJualanItems(items, undefined, saleData.id);
      console.log("Sale items created successfully for jualanGrosir:", saleData.id);
    } catch (itemsError) {
      console.error("Error creating sale items for jualanGrosir:", itemsError);
      try {
        // Best-effort cleanup: remove any partially inserted items/payments + the sale record.
        // This prevents "0 items" transactions and avoids orphaned rows.
        await supabase.from("jualanItems").delete().eq("jualanGrosirId", saleData.id);
        await supabase.from("grosirPayments").delete().eq("jualanGrosirId", saleData.id);
        await supabase.from("jualanGrosir").delete().eq("id", saleData.id);
      } catch (cleanupError) {
        console.error("Rollback failed for jualanGrosir:", cleanupError);
      }
      throw itemsError;
    }
  } else if (saleData && items.length === 0) {
    // Prevent creating empty wholesale transactions that cannot be printed
    try {
      await supabase.from("jualanGrosir").delete().eq("id", saleData.id);
    } catch {
      // ignore rollback error
    }
    throw new Error("Cannot complete wholesale sale without items.");
  }

  return saleData;
}

export async function getJualanGrosirToday(): Promise<JualanGrosir[]> {
  if (USE_NEON) return neon.neonGetJualanGrosirToday() as Promise<JualanGrosir[]>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("jualanGrosir")
    .select("*")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllJualanGrosir(): Promise<JualanGrosir[]> {
  if (USE_NEON) return neon.neonGetAllJualanGrosir() as Promise<JualanGrosir[]>;
  const { data, error } = await supabase
    .from("jualanGrosir")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Get wholesale sales within a date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive, defaults to today)
 * @param userId - Optional user ID to filter by (for cashiers)
 */
export async function getJualanGrosirByDateRange(
  startDate: Date,
  endDate?: Date,
  userId?: string
): Promise<JualanGrosir[]> {
  const end = endDate || new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  if (USE_NEON) return neon.neonGetJualanGrosirByDateRange(start.toISOString(), end.toISOString(), userId) as Promise<JualanGrosir[]>;
  let query = supabase.from("jualanGrosir").select("*").gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  if (userId) query = query.eq("userId", userId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Sale Items (Jualan Items)
/**
 * Create sale items for a sale (bulk insert)
 * @param items - Array of cart items
 * @param jualanKontanId - ID of cash sale (if cash sale)
 * @param jualanGrosirId - ID of wholesale sale (if wholesale sale)
 */
async function ensureBarangsExistForCartItems(items: CartItem[]): Promise<void> {
  const uniqueIds = Array.from(
    new Set(
      items
        .map((i) => i?.barang?.id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim().toUpperCase())
    )
  );

  if (uniqueIds.length === 0) return;

  if (USE_NEON) {
    const all = await neon.neonGetBarangs();
    const existingIds = new Set((all || []).map((r: any) => String(r.id).toUpperCase()));
    const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
    const nowIso = new Date().toISOString();
    for (const id of missingIds) {
      const sourceItem = items.find((it) => it?.barang?.id?.trim().toUpperCase() === id);
      const barang = sourceItem?.barang;
      const fallbackName = barang?.barangNama || "MANUAL ITEM";
      await neon.neonCreateBarang({
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
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("barangs")
    .select("id")
    .in("id", uniqueIds);

  // If we can't check existence (RLS, network), don't block checkout here.
  // The insert into `jualanItems` will still surface a clear FK error if needed.
  if (existingError) {
    console.warn("Could not verify barangs existence before saving items:", existingError);
    return;
  }

  const existingIds = new Set((existing || []).map((r: any) => String(r.id).toUpperCase()));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return;

  const nowIso = new Date().toISOString();
  const rows = missingIds.map((id) => {
    const sourceItem = items.find((it) => it?.barang?.id?.trim().toUpperCase() === id);
    const barang = sourceItem?.barang;
    const fallbackName = barang?.barangNama || "MANUAL ITEM";

    // Create a minimal product row so `jualanItems.barangId` FK is satisfied.
    // This primarily supports "Tambah Barang Manual" items whose IDs don't exist in `barangs`.
    return {
      id,
      createdAt: barang?.createdAt || nowIso,
      createdBy: barang?.createdBy || "system",
      barangNama: String(fallbackName).toUpperCase(),
      barangType: barang?.barangType || "Manual",
      barangUnit: barang?.barangUnit || "Pcs",
      barangHarga: typeof barang?.barangHarga === "number" ? barang.barangHarga : sourceItem?.price || 0,
      barangModal: typeof barang?.barangModal === "number" ? barang.barangModal : 0,
      barangGrosir:
        typeof barang?.barangGrosir === "number" ? barang.barangGrosir : sourceItem?.price || 0,
      barangBon: typeof barang?.barangBon === "number" ? barang.barangBon : 0,
      barangNote: barang?.barangNote ?? "Auto-created for manual sale item",
      stockBarang: typeof barang?.stockBarang === "number" ? barang.stockBarang : 0,
      stockTokoMini: typeof barang?.stockTokoMini === "number" ? barang.stockTokoMini : 0,
    };
  });

  const { error: insertError } = await supabase.from("barangs").insert(rows as any);
  if (insertError) {
    console.error("Failed to create missing barangs for sale items:", insertError);
    throw new Error(
      "Failed to save manual item(s). Please check Supabase RLS policies for `barangs` (INSERT) or ask an admin to create the item."
    );
  }
}

export async function createJualanItems(
  items: CartItem[],
  jualanKontanId?: string,
  jualanGrosirId?: string
): Promise<JualanItem[]> {
  try {
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

    if (USE_NEON) {
      const inserted = await neon.neonCreateJualanItems(itemsToInsert);
      return (inserted || []) as JualanItem[];
    }

    // First try a single bulk insert (fast path)
    const bulkResult = await supabase.from("jualanItems").insert(itemsToInsert as any).select();

    if (!bulkResult.error) {
      console.log("JualanItems created successfully:", bulkResult.data);
      return (bulkResult.data || []) as JualanItem[];
    }

    // Fallback: insert one-by-one to avoid losing ALL items if a single row fails
    console.error("Bulk insert failed, falling back to per-item insert:", bulkResult.error);
    const inserted: JualanItem[] = [];
    const errors: Array<{ index: number; message: string; code?: string }> = [];

    for (let i = 0; i < itemsToInsert.length; i++) {
      const row = itemsToInsert[i];
      const { data, error } = await supabase.from("jualanItems").insert(row as any).select().single();
      if (error) {
        errors.push({ index: i, message: error.message, code: (error as any).code });
      } else if (data) {
        inserted.push(data as JualanItem);
      }
    }

    if (errors.length > 0) {
      console.error("Per-item insert errors:", errors);
      const summary =
        errors.length === 1
          ? `Failed to save 1 item (index ${errors[0].index}): ${errors[0].message}`
          : `Failed to save ${errors.length} items. First error (index ${errors[0].index}): ${errors[0].message}`;
      throw new Error(summary);
    }

    console.log("JualanItems created successfully (per-item):", inserted);
    return inserted;
  } catch (error) {
    console.error("createJualanItems error:", error);
    throw error;
  }
}

/**
 * Get all items for a specific cash sale
 * @param jualanKontanId - ID of the cash sale
 */
export async function getJualanItemsByKontanId(jualanKontanId: string): Promise<JualanItem[]> {
  if (USE_NEON) return neon.neonGetJualanItemsByKontanId(jualanKontanId) as Promise<JualanItem[]>;
  console.log("getJualanItemsByKontanId called with:", jualanKontanId);
  const { data, error } = await supabase
    .from("jualanItems")
    .select("*")
    .eq("jualanKontanId", jualanKontanId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching jualanItems by kontanId:", error);
    throw error;
  }
  console.log("getJualanItemsByKontanId result:", data?.length || 0, "items");
  return (data || []) as JualanItem[];
}

/**
 * Get all items for a specific wholesale sale
 * @param jualanGrosirId - ID of the wholesale sale
 */
export async function getJualanItemsByGrosirId(jualanGrosirId: string): Promise<JualanItem[]> {
  if (USE_NEON) return neon.neonGetJualanItemsByGrosirId(jualanGrosirId) as Promise<JualanItem[]>;
  console.log("getJualanItemsByGrosirId called with:", jualanGrosirId);
  const { data, error } = await supabase
    .from("jualanItems")
    .select("*")
    .eq("jualanGrosirId", jualanGrosirId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching jualanItems by grosirId:", error);
    throw error;
  }
  console.log("getJualanItemsByGrosirId result:", data?.length || 0, "items");
  return (data || []) as JualanItem[];
}

/**
 * Get all sales for a specific product (for purchase history)
 * @param barangId - ID of the product
 */
export async function getJualanItemsByBarangId(barangId: string): Promise<JualanItem[]> {
  const { data, error } = await supabase
    .from("jualanItems")
    .select("*")
    .eq("barangId", barangId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as JualanItem[];
}

/**
 * Add a payment record: insert into grosirPayments and update jualanGrosir
 * @param jualanGrosirId - ID of the wholesale sale
 * @param payment - Payment record to add
 * @param userId - Optional user ID who recorded the payment
 */
export async function addGrosirPayment(
  jualanGrosirId: string,
  payment: PaymentRecord,
  userId?: string
): Promise<JualanGrosir> {
  try {
    const paidAt = payment.date ? new Date(payment.date) : undefined;
    await insertGrosirPayment(
      jualanGrosirId,
      payment.amount,
      payment.paymentMethod,
      payment.createdBy,
      paidAt,
      userId
    );

    if (USE_NEON) {
      const sale = await neon.neonGetJualanGrosirById(jualanGrosirId) as JualanGrosir;
      if (!sale) throw new Error("Sale not found");
      const existingPayments: PaymentRecord[] = sale.paymentHistory || [];
      const updatedPayments = [...existingPayments, payment];
      const newSetorGrosir = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newSisaBonGrosir = sale.totalBelanja - newSetorGrosir;
      const { payment_status, percent_paid } = getGrosirPaymentStatus(newSetorGrosir, sale.totalBelanja);
      const updated = await neon.neonUpdateJualanGrosir(jualanGrosirId, {
        paymentHistory: updatedPayments,
        setorGrosir: newSetorGrosir,
        sisaBonGrosir: newSisaBonGrosir,
        payment_status,
        percent_paid,
      }) as JualanGrosir;
      return updated;
    }

    const { data: sale, error: fetchError } = await supabase
      .from("jualanGrosir")
      .select("*")
      .eq("id", jualanGrosirId)
      .single();

    if (fetchError) {
      console.error("Error fetching jualanGrosir:", fetchError);
      throw fetchError;
    }

    const saleData = sale as JualanGrosir;
    const existingPayments: PaymentRecord[] = saleData.paymentHistory || [];
    const updatedPayments = [...existingPayments, payment];
    const newSetorGrosir = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newSisaBonGrosir = saleData.totalBelanja - newSetorGrosir;
    const { payment_status, percent_paid } = getGrosirPaymentStatus(
      newSetorGrosir,
      saleData.totalBelanja
    );

    // Update jualanGrosir with aggregates and status (keep paymentHistory for backward compat)
    const { data: updatedSale, error: updateError } = await supabase
      .from("jualanGrosir")
      .update({
        paymentHistory: updatedPayments,
        setorGrosir: newSetorGrosir,
        sisaBonGrosir: newSisaBonGrosir,
        payment_status,
        percent_paid,
      } as never)
      .eq("id", jualanGrosirId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating jualanGrosir:", updateError);
      throw updateError;
    }

    console.log("Payment added successfully to jualanGrosir:", jualanGrosirId);
    return updatedSale as JualanGrosir;
  } catch (error) {
    console.error("addGrosirPayment error:", error);
    throw error;
  }
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

  if (USE_NEON) {
    const draft = await neon.neonCreateGrosirDraft({
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

  const { data: draft, error: draftError } = await supabase
    .from("grosirDrafts")
    .insert({
      createdBy: userId || null,
      namaPelanggan: namaPelanggan || "",
      totalBelanja,
      setorAwal: setorAwal || 0,
      status: "draft",
    } as never)
    .select()
    .single();

  if (draftError) {
    console.error("Error creating grosir draft:", draftError);
    throw draftError;
  }

  if (items.length > 0 && draft) {
    const rows = items.map((item) => ({
      grosirDraftId: (draft as GrosirDraft).id,
      barangId: item.barang.id,
      barangNama: item.barang.barangNama,
      barangUnit: item.barang.barangUnit || "Pcs",
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));
    const { error: itemsError } = await supabase.from("grosirDraftItems").insert(rows as never);
    if (itemsError) {
      console.error("Error creating grosir draft items:", itemsError);
      await supabase.from("grosirDrafts").delete().eq("id", (draft as GrosirDraft).id);
      throw itemsError;
    }
  }

  return draft as GrosirDraft;
}

export async function updateGrosirDraft(
  draftId: string,
  namaPelanggan: string,
  totalBelanja: number,
  setorAwal: number,
  items: CartItem[]
): Promise<GrosirDraft> {
  await ensureBarangsExistForCartItems(items);

  if (USE_NEON) {
    const updated = await neon.neonUpdateGrosirDraft(draftId, {
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

  const { error: updateError } = await supabase
    .from("grosirDrafts")
    .update({
      namaPelanggan: namaPelanggan || "",
      totalBelanja,
      setorAwal: setorAwal || 0,
    } as never)
    .eq("id", draftId);

  if (updateError) {
    console.error("Error updating grosir draft:", updateError);
    throw updateError;
  }

  const { error: deleteError } = await supabase
    .from("grosirDraftItems")
    .delete()
    .eq("grosirDraftId", draftId);

  if (deleteError) {
    console.error("Error deleting grosir draft items:", deleteError);
    throw deleteError;
  }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      grosirDraftId: draftId,
      barangId: item.barang.id,
      barangNama: item.barang.barangNama,
      barangUnit: item.barang.barangUnit || "Pcs",
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));
    const { error: itemsError } = await supabase.from("grosirDraftItems").insert(rows as never);
    if (itemsError) {
      console.error("Error inserting grosir draft items:", itemsError);
      throw itemsError;
    }
  }

  const updated = await getGrosirDraftById(draftId);
  if (!updated) throw new Error("Draft not found after update");
  return updated;
}

export async function getGrosirDrafts(userId?: string): Promise<GrosirDraft[]> {
  if (USE_NEON) return neon.neonGetGrosirDrafts(userId) as Promise<GrosirDraft[]>;
  let q = supabase.from("grosirDrafts").select("*").eq("status", "draft").order("updated_at", { ascending: false });
  if (userId) q = q.eq("createdBy", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as GrosirDraft[];
}

export async function getGrosirDraftById(id: string): Promise<GrosirDraft | null> {
  if (USE_NEON) return neon.neonGetGrosirDraftById(id) as Promise<GrosirDraft | null>;
  const { data, error } = await supabase.from("grosirDrafts").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as GrosirDraft;
}

export async function getGrosirDraftItems(draftId: string): Promise<GrosirDraftItem[]> {
  if (USE_NEON) return neon.neonGetGrosirDraftItems(draftId) as Promise<GrosirDraftItem[]>;
  const { data, error } = await supabase.from("grosirDraftItems").select("*").eq("grosirDraftId", draftId).order("barangNama");
  if (error) throw error;
  return (data || []) as GrosirDraftItem[];
}

export async function deleteGrosirDraft(id: string): Promise<void> {
  if (USE_NEON) {
    await neon.neonDeleteGrosirDraft(id);
    return;
  }
  const { error } = await supabase.from("grosirDrafts").delete().eq("id", id);
  if (error) throw error;
}
