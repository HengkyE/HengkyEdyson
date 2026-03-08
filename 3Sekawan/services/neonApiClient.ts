/**
 * Neon API client for 3Sekawan – POS + billiard sessions & shop expenses.
 * Used when EXPO_PUBLIC_API_URL is set (same server as EdysonPOS).
 */

const BASE = process.env.EXPO_PUBLIC_API_URL || "";

function apiUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, BASE);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(apiUrl(path, params), { method: "GET", headers: { Accept: "application/json" } });
  if (res.status === 404) return null as T;
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
}

export function isNeonApiEnabled(): boolean {
  return Boolean(BASE.trim());
}

// Categories
export async function neonGetCategories() {
  return apiGet<any[]>("api/categories");
}
export async function neonCreateCategory(title: string) {
  return apiPost<any>("api/categories", { title });
}

// System
export async function neonGetSystemData() {
  return apiGet<any | null>("api/system-data");
}
export async function neonGetNextGrosirInvoiceNo() {
  const r = await apiPost<{ nextNo: number }>("api/next-grosir-invoice", {});
  return r.nextNo;
}

// Barangs
export async function neonGetBarangs() {
  return apiGet<any[]>("api/barangs");
}
export async function neonGetBarangById(id: string) {
  return apiGet<any | null>(`api/barangs/${encodeURIComponent(id)}`);
}
export async function neonCreateBarang(body: any) {
  return apiPost<any>("api/barangs", body);
}
export async function neonUpdateBarang(id: string, updates: any) {
  return apiPatch<any>(`api/barangs/${encodeURIComponent(id)}`, updates);
}
export async function neonUpdateBarangStock(id: string, stockBarang: number, stockTokoMini?: number) {
  await apiPatch(`api/barangs/${encodeURIComponent(id)}/stock`, { stockBarang, stockTokoMini });
}
export async function neonDeleteBarang(id: string) {
  return apiDelete(`api/barangs/${encodeURIComponent(id)}`);
}

// User profiles
export async function neonGetUserProfile(userId: string) {
  return apiGet<any | null>(`api/user-profiles/${userId}`);
}
export async function neonGetAllUserProfiles() {
  return apiGet<any[]>("api/user-profiles");
}
export async function neonCreateUserProfile(data: any) {
  return apiPost<any>("api/user-profiles", data);
}
export async function neonUpdateUserProfile(userId: string, updates: any) {
  return apiPatch<any>(`api/user-profiles/${userId}`, updates);
}
export async function neonGetUsersWithoutProfiles() {
  return apiGet<any[]>("api/users-without-profiles");
}

// Jualan Kontan
export async function neonGetJualanKontanToday() {
  return apiGet<any[]>("api/jualan-kontan", { today: "true" });
}
export async function neonGetAllJualanKontan() {
  return apiGet<any[]>("api/jualan-kontan");
}
export async function neonGetJualanKontanByDateRange(start: string, end: string, userId?: string) {
  return apiGet<any[]>("api/jualan-kontan/date-range", { start, end, ...(userId ? { userId } : {}) });
}
export async function neonCreateJualanKontan(body: any) {
  return apiPost<any>("api/jualan-kontan", body);
}

// Jualan Items
export async function neonGetJualanItemsByKontanId(id: string) {
  return apiGet<any[]>(`api/jualan-items/kontan/${id}`);
}
export async function neonGetJualanItemsByGrosirId(id: string) {
  return apiGet<any[]>(`api/jualan-items/grosir/${id}`);
}
export async function neonCreateJualanItems(items: any[]) {
  return apiPost<any[]>("api/jualan-items", items);
}

// Jualan Grosir
export async function neonGetJualanGrosirToday() {
  return apiGet<any[]>("api/jualan-grosir", { today: "true" });
}
export async function neonGetAllJualanGrosir() {
  return apiGet<any[]>("api/jualan-grosir");
}
export async function neonGetJualanGrosirByDateRange(start: string, end: string, userId?: string) {
  return apiGet<any[]>("api/jualan-grosir/date-range", { start, end, ...(userId ? { userId } : {}) });
}
export async function neonGetJualanGrosirById(id: string) {
  return apiGet<any>(`api/jualan-grosir/${id}`);
}
export async function neonCreateJualanGrosir(body: any) {
  return apiPost<any>("api/jualan-grosir", body);
}
export async function neonUpdateJualanGrosir(id: string, body: any) {
  return apiPatch<any>(`api/jualan-grosir/${id}`, body);
}
export async function neonDeleteJualanGrosir(id: string) {
  return apiDelete(`api/jualan-grosir/${id}`);
}

// Grosir payments
export async function neonGetGrosirPaymentsByJualanGrosirId(jualanGrosirId: string) {
  return apiGet<any[]>(`api/grosir-payments/${jualanGrosirId}`);
}
export async function neonGetGrosirPaymentsByDateRange(start: string, end: string) {
  return apiGet<any[]>("api/grosir-payments/date-range", { start, end });
}
export async function neonInsertGrosirPayment(body: any) {
  return apiPost<any>("api/grosir-payments", body);
}

// Grosir drafts
export async function neonGetGrosirDrafts(userId?: string) {
  return apiGet<any[]>("api/grosir-drafts", userId ? { userId } : undefined);
}
export async function neonGetGrosirDraftById(id: string) {
  return apiGet<any | null>(`api/grosir-drafts/${id}`);
}
export async function neonGetGrosirDraftItems(draftId: string) {
  return apiGet<any[]>(`api/grosir-drafts/${draftId}/items`);
}
export async function neonCreateGrosirDraft(body: any) {
  return apiPost<any>("api/grosir-drafts", body);
}
export async function neonUpdateGrosirDraft(id: string, body: any) {
  return apiPatch<any>(`api/grosir-drafts/${id}`, body);
}
export async function neonDeleteGrosirDraft(id: string) {
  return apiDelete(`api/grosir-drafts/${id}`);
}

// Billiard sessions (3Sekawan)
export async function neonGetBilliardSessions(status?: string) {
  return apiGet<any[]>("api/billiard/sessions", status ? { status } : undefined);
}

export async function neonInsertBilliardSession(body: {
  table_number: number;
  started_at?: string;
  duration_hours: number;
  rate_per_hour: number;
  status?: string;
  cashier_id: string;
}) {
  return apiPost<any>("api/billiard/sessions", body);
}

export async function neonUpdateBilliardSession(
  id: string,
  body: { duration_hours?: number; rate_per_hour?: number; status?: string; paid_at?: string | null; payment_method?: string | null }
) {
  return apiPatch<any>(`api/billiard/sessions/${id}`, body);
}

// Shop expenses (3Sekawan)
export async function neonGetShopExpenses(expense_date?: string, category?: string) {
  return apiGet<any[]>("api/billiard/shop-expenses", { ...(expense_date ? { expense_date } : {}), ...(category ? { category } : {}) });
}

export async function neonInsertShopExpense(body: {
  expense_date: string;
  category: string;
  description?: string | null;
  amount: number;
  created_by?: string | null;
  notes?: string | null;
}) {
  return apiPost<any>("api/billiard/shop-expenses", body);
}

export async function neonDeleteShopExpense(id: string) {
  return apiDelete(`api/billiard/shop-expenses/${id}`);
}
