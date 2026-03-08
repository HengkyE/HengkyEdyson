/**
 * Billiard sessions and shop expenses – uses Neon API when EXPO_PUBLIC_API_URL is set, else Supabase.
 */

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import * as neon from "./neonApiClient";

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];
export type SessionUpdate = Database["public"]["Tables"]["sessions"]["Update"];
export type ExpenseRow = Database["public"]["Tables"]["shop_expenses"]["Row"];
export type ExpenseInsert = Database["public"]["Tables"]["shop_expenses"]["Insert"];

const USE_NEON = neon.isNeonApiEnabled();

export async function getBilliardSessions(status?: "active" | "ended"): Promise<SessionRow[]> {
  if (USE_NEON) {
    const rows = await neon.neonGetBilliardSessions(status);
    return (rows || []) as SessionRow[];
  }
  let q = supabase.from("sessions").select("*").order("started_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as SessionRow[];
}

export async function insertBilliardSession(
  row: Omit<SessionInsert, "id" | "started_at"> & { started_at?: string }
): Promise<SessionRow> {
  if (USE_NEON) {
    const created = await neon.neonInsertBilliardSession({
      table_number: row.table_number,
      started_at: row.started_at ?? new Date().toISOString(),
      duration_hours: row.duration_hours,
      rate_per_hour: row.rate_per_hour,
      status: row.status ?? "active",
      cashier_id: row.cashier_id,
    });
    return created as SessionRow;
  }
  const { data, error } = await supabase
    .from("sessions")
    .insert(row as SessionInsert)
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
}

export async function updateBilliardSession(
  id: string,
  updates: Partial<Pick<SessionUpdate, "duration_hours" | "rate_per_hour" | "status" | "paid_at" | "payment_method">>
): Promise<SessionRow | null> {
  if (USE_NEON) {
    const updated = await neon.neonUpdateBilliardSession(id, {
      duration_hours: updates.duration_hours,
      rate_per_hour: updates.rate_per_hour,
      status: updates.status,
      paid_at: updates.paid_at ?? undefined,
      payment_method: updates.payment_method ?? undefined,
    });
    return updated as SessionRow;
  }
  const { data, error } = await supabase
    .from("sessions")
    .update(updates as SessionUpdate)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
}

export async function getShopExpenses(filters?: { expense_date?: string; category?: string }): Promise<ExpenseRow[]> {
  if (USE_NEON) {
    const rows = await neon.neonGetShopExpenses(filters?.expense_date, filters?.category);
    return (rows || []) as ExpenseRow[];
  }
  let q = supabase.from("shop_expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  if (filters?.expense_date) q = q.eq("expense_date", filters.expense_date);
  if (filters?.category) q = q.eq("category", filters.category);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ExpenseRow[];
}

export async function insertShopExpense(row: ExpenseInsert): Promise<ExpenseRow> {
  if (USE_NEON) {
    const created = await neon.neonInsertShopExpense({
      expense_date: row.expense_date,
      category: row.category,
      description: row.description ?? null,
      amount: row.amount,
      created_by: row.created_by ?? null,
      notes: row.notes ?? null,
    });
    return created as ExpenseRow;
  }
  const { data, error } = await supabase.from("shop_expenses").insert(row).select().single();
  if (error) throw error;
  return data as ExpenseRow;
}

export async function deleteShopExpense(id: string): Promise<void> {
  if (USE_NEON) {
    await neon.neonDeleteShopExpense(id);
    return;
  }
  const { error } = await supabase.from("shop_expenses").delete().eq("id", id);
  if (error) throw error;
}
