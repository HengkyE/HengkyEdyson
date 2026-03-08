/**
 * Neon API client – same interface as database.ts but calls the Neon backend.
 * Used when EXPO_PUBLIC_API_URL is set (data stored in Neon).
 * Placeholder URLs (e.g. your-project.vercel.app) are treated as "not set" so the app can use direct Data API instead.
 */

const RAW_BASE = (process.env.EXPO_PUBLIC_API_URL || "").trim();
const IS_PLACEHOLDER = /your-project\.vercel\.app|localhost:3001/i.test(RAW_BASE) && !RAW_BASE.startsWith("http://localhost");
const BASE = IS_PLACEHOLDER ? "" : RAW_BASE;

function apiUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, BASE);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

function wrapNetworkError(e: unknown, context: string): Error {
  const message = e instanceof Error ? e.message : String(e);
  if (message === "Load failed" || message === "Failed to fetch" || message.includes("NetworkError") || message.includes("network")) {
    return new Error(
      `Cannot connect to the API server at ${BASE || "EXPO_PUBLIC_API_URL"}. ` +
        "Make sure the backend is running (e.g. npm run server) and .env has EXPO_PUBLIC_API_URL set."
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  try {
    const res = await fetch(apiUrl(path, params), { method: "GET", headers: { Accept: "application/json" } });
    if (res.status === 404) return null as T;
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  } catch (e) {
    throw wrapNetworkError(e, "GET " + path);
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await fetch(apiUrl(path), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  } catch (e) {
    throw wrapNetworkError(e, "POST " + path);
  }
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await fetch(apiUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  } catch (e) {
    throw wrapNetworkError(e, "PATCH " + path);
  }
}

async function apiDelete(path: string): Promise<void> {
  try {
    const res = await fetch(apiUrl(path), { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  } catch (e) {
    throw wrapNetworkError(e, "DELETE " + path);
  }
}

/** True only when a real backend URL is set (not a placeholder). Use direct Data API when you don't want a backend. */
export function isNeonApiEnabled(): boolean {
  return Boolean(BASE);
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
