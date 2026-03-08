/**
 * Neon database test helpers (Supabase was removed).
 */

import { getBarangs } from "@/edysonpos/services/database";

export async function testNeonConnection(): Promise<boolean> {
  try {
    const data = await getBarangs();
    console.log("✅ Neon connection OK, barangs count:", data?.length ?? 0);
    return true;
  } catch (e: any) {
    console.error("❌ Neon connection failed:", e?.message);
    return false;
  }
}

export async function testBarangById(id: string) {
  const { getBarangByBarcode } = await import("@/edysonpos/services/database");
  return getBarangByBarcode(id);
}

/** @deprecated Use testNeonConnection */
export async function testSupabaseConnection(): Promise<boolean> {
  return testNeonConnection();
}
