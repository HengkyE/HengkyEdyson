/**
 * Direct Neon Data API client – no backend server.
 * Uses EXPO_PUBLIC_NEON_DATA_API_URL and JWT from Neon Auth (getNeonAuthToken).
 * Enable the Data API in Neon Console → Data API, and set "Use Neon Auth" so JWT works.
 *
 * Table and column names match Neon schema: EdysonPOSSample_* (see server/index.js).
 */

import { getNeonAuthToken } from "@/lib/neonAuthClient";

const BASE = (process.env.EXPO_PUBLIC_NEON_DATA_API_URL || "").replace(/\/$/, "");
const REST = `${BASE}/rest/v1`;

/** Thrown on Data API errors; use statusCode to show "sign in again" (401) or "no permission" (403). */
export class NeonDataApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = "NeonDataApiError";
  }
}

async function parseErrorResponse(res: Response): Promise<{ message: string; code?: string; details?: string }> {
  const raw = await res.text();
  let message = res.statusText;
  let code: string | undefined;
  let details: string | undefined;
  try {
    const j = JSON.parse(raw);
    message = j.message ?? j.error ?? j.details ?? message;
    if (typeof message === "object") message = (message as any).message ?? res.statusText;
    code = j.code;
    details = j.details ?? (typeof j.hint === "string" ? j.hint : undefined);
  } catch {
    if (raw) message = raw.slice(0, 200);
  }
  return { message: String(message), code, details };
}

async function throwIfNotOk(res: Response, _context: string): Promise<void> {
  if (res.ok || res.status === 404) return;
  const { message, code, details } = await parseErrorResponse(res);
  let userMessage: string;
  if (res.status === 401) {
    userMessage = "Session expired or not signed in. Please sign in again.";
  } else if (res.status === 403) {
    userMessage = "You don’t have permission to access this data. Check Neon Data API and RLS settings.";
  } else if (res.status === 404) {
    userMessage = "Resource not found.";
  } else if (res.status >= 500) {
    userMessage = "Database is temporarily unavailable. Please try again later.";
  } else {
    userMessage = message || res.statusText || "Request failed.";
  }
  throw new NeonDataApiError(userMessage, res.status, code, details);
}

async function headers(): Promise<Record<string, string>> {
  const token = await getNeonAuthToken();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function restUrl(table: string, query?: Record<string, string>): string {
  const url = `${REST}/${table}`;
  if (!query || Object.keys(query).length === 0) return url;
  const params = new URLSearchParams(query);
  return `${url}?${params.toString()}`;
}

async function dataGet<T>(table: string, query?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(restUrl(table, query), { method: "GET", headers: await headers() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|network|load failed/i.test(msg)) {
      throw new NeonDataApiError(
        "Cannot reach the database. Check your connection and EXPO_PUBLIC_NEON_DATA_API_URL.",
        0,
        "NETWORK_ERROR"
      );
    }
    throw e;
  }
  if (res.status === 404) return null as T;
  await throwIfNotOk(res, `GET ${table}`);
  return res.json();
}

async function dataPost<T>(table: string, body: unknown, prefer = "return=representation"): Promise<T> {
  const h = await headers();
  if (prefer) h["Prefer"] = prefer;
  let res: Response;
  try {
    res = await fetch(restUrl(table), { method: "POST", headers: h, body: JSON.stringify(body) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|network|load failed/i.test(msg)) {
      throw new NeonDataApiError(
        "Cannot reach the database. Check your connection and EXPO_PUBLIC_NEON_DATA_API_URL.",
        0,
        "NETWORK_ERROR"
      );
    }
    throw e;
  }
  await throwIfNotOk(res, `POST ${table}`);
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function dataPatch<T>(table: string, filter: Record<string, string>, body: unknown): Promise<T> {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(filter)) q[k] = `eq.${v}`;
  const h = { ...(await headers()), Prefer: "return=representation" };
  let res: Response;
  try {
    res = await fetch(restUrl(table, q), { method: "PATCH", headers: h, body: JSON.stringify(body) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|network|load failed/i.test(msg)) {
      throw new NeonDataApiError(
        "Cannot reach the database. Check your connection and EXPO_PUBLIC_NEON_DATA_API_URL.",
        0,
        "NETWORK_ERROR"
      );
    }
    throw e;
  }
  await throwIfNotOk(res, `PATCH ${table}`);
  const text = await res.text();
  if (!text) return undefined as T;
  const arr = JSON.parse(text);
  return Array.isArray(arr) ? arr[0] : arr;
}

async function dataDelete(table: string, filter: Record<string, string>): Promise<void> {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(filter)) q[k] = `eq.${v}`;
  let res: Response;
  try {
    res = await fetch(restUrl(table, q), { method: "DELETE", headers: await headers() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|network|load failed/i.test(msg)) {
      throw new NeonDataApiError(
        "Cannot reach the database. Check your connection and EXPO_PUBLIC_NEON_DATA_API_URL.",
        0,
        "NETWORK_ERROR"
      );
    }
    throw e;
  }
  if (res.status !== 204) await throwIfNotOk(res, `DELETE ${table}`);
}

/** Neon schema table names (must match DB; see server/index.js). */
const T = {
  categories: "EdysonPOSSample_categories",
  systemData: "EdysonPOSSample_systemData",
  barangs: "EdysonPOSSample_barangs",
  userProfiles: "EdysonPOSSample_userProfiles",
  jualanKontan: "EdysonPOSSample_jualanKontan",
  jualanItems: "EdysonPOSSample_jualanItems",
  jualanGrosir: "EdysonPOSSample_jualanGrosir",
  grosirPayments: "EdysonPOSSample_grosirPayments",
  grosirDrafts: "EdysonPOSSample_grosirDrafts",
  grosirDraftItems: "EdysonPOSSample_grosirDraftItems",
} as const;

export function isNeonDataApiEnabled(): boolean {
  return Boolean(BASE.trim());
}

// Categories (schema: id, title, created_at)
export async function neonGetCategories() {
  const data = await dataGet<any[]>(T.categories, { select: "*", order: "title.asc" });
  return data ?? [];
}
export async function neonCreateCategory(title: string) {
  const rows = await dataPost<any[]>(T.categories, { title });
  return Array.isArray(rows) ? rows[0] : rows;
}

// System (schema: id, grosirInvoiceNo, created_at)
export async function neonGetSystemData() {
  const data = await dataGet<any[]>(T.systemData, { select: "*", limit: "1" });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
export async function neonGetNextGrosirInvoiceNo() {
  const data = await dataGet<any[]>(T.systemData, { id: "eq.notaGrosir", select: "*" });
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const nextNo = row?.grosirInvoiceNo != null ? Number(row.grosirInvoiceNo) + 1 : 1;
  if (row) {
    await dataPatch(T.systemData, { id: "notaGrosir" }, { grosirInvoiceNo: nextNo });
  } else {
    await dataPost(T.systemData, { id: "notaGrosir", grosirInvoiceNo: nextNo }, "");
  }
  return nextNo;
}

// Barangs (schema: id, createdBy, barangNama, barangType, barangUnit, barangHarga, barangModal, barangGrosir, barangBon, barangNote, stockBarang, stockTokoMini, createdAt)
export async function neonGetBarangs() {
  const data = await dataGet<any[]>(T.barangs, { select: "*", order: "barangNama.asc" });
  return data ?? [];
}
export async function neonGetBarangById(id: string) {
  const data = await dataGet<any[]>(T.barangs, { id: `eq.${id}`, select: "*" });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
export async function neonCreateBarang(body: any) {
  const rows = await dataPost<any[]>(T.barangs, body);
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function neonUpdateBarang(id: string, updates: any) {
  return dataPatch<any>(T.barangs, { id }, updates);
}
export async function neonUpdateBarangStock(id: string, stockBarang: number, stockTokoMini?: number) {
  const body: any = { stockBarang };
  if (stockTokoMini !== undefined) body.stockTokoMini = stockTokoMini;
  await dataPatch(T.barangs, { id }, body);
}
export async function neonDeleteBarang(id: string) {
  await dataDelete(T.barangs, { id });
}

// User profiles (schema: id, fullName, email, phone, role, isActive, created_at, updated_at, lastLoginAt)
export async function neonGetUserProfile(userId: string) {
  const data = await dataGet<any[]>(T.userProfiles, { id: `eq.${userId}`, select: "*" });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
export async function neonGetAllUserProfiles() {
  const data = await dataGet<any[]>(T.userProfiles, { select: "*", order: "created_at.desc" });
  return data ?? [];
}
export async function neonCreateUserProfile(data: any) {
  const rows = await dataPost<any[]>(T.userProfiles, data);
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function neonUpdateUserProfile(userId: string, updates: any) {
  return dataPatch<any>(T.userProfiles, { id: userId }, updates);
}
export async function neonGetUsersWithoutProfiles() {
  return [];
}

// Jualan Kontan (schema: id, totalBelanja, namaKasir, caraPembayaran, created_atIndo, userId, created_at)
export async function neonGetJualanKontanToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();
  const data = await dataGet<any[]>(T.jualanKontan, {
    select: "*",
    created_at: `gte.${iso}`,
    order: "created_at.desc",
  });
  return data ?? [];
}
export async function neonGetAllJualanKontan() {
  const data = await dataGet<any[]>(T.jualanKontan, { select: "*", order: "created_at.desc" });
  return data ?? [];
}
export async function neonGetJualanKontanByDateRange(start: string, end: string, userId?: string) {
  let data = await dataGet<any[]>(T.jualanKontan, {
    select: "*",
    created_at: `gte.${start}`,
    order: "created_at.desc",
  });
  if (!data) data = [];
  data = (data as any[]).filter((r: any) => r.created_at <= end);
  if (userId) data = data.filter((r: any) => r.userId === userId);
  return data;
}
export async function neonCreateJualanKontan(body: any) {
  const rows = await dataPost<any[]>(T.jualanKontan, body);
  return Array.isArray(rows) ? rows[0] : rows;
}

// Jualan Items (schema: id, jualanKontanId, jualanGrosirId, barangId, barangNama, quantity, unitPrice, totalPrice, barangUnit, created_at)
export async function neonGetJualanItemsByKontanId(id: string) {
  const data = await dataGet<any[]>(T.jualanItems, {
    select: "*",
    jualanKontanId: `eq.${id}`,
    order: "created_at.asc",
  });
  return data ?? [];
}
export async function neonGetJualanItemsByGrosirId(id: string) {
  const data = await dataGet<any[]>(T.jualanItems, {
    select: "*",
    jualanGrosirId: `eq.${id}`,
    order: "created_at.asc",
  });
  return data ?? [];
}
export async function neonCreateJualanItems(items: any[]) {
  const inserted: any[] = [];
  for (const it of items) {
    const rows = await dataPost<any[]>(T.jualanItems, it);
    inserted.push(Array.isArray(rows) ? rows[0] : rows);
  }
  return inserted;
}

// Jualan Grosir (schema: id, invoiceNo, namaPelanggan, totalBelanja, setorGrosir, sisaBonGrosir, namaKasir, caraPembayaran, created_atIndo, paymentHistory, payment_status, percent_paid, userId, created_at)
export async function neonGetJualanGrosirToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data = await dataGet<any[]>(T.jualanGrosir, {
    select: "*",
    created_at: `gte.${today.toISOString()}`,
    order: "created_at.desc",
  });
  return data ?? [];
}
export async function neonGetAllJualanGrosir() {
  const data = await dataGet<any[]>(T.jualanGrosir, { select: "*", order: "created_at.desc" });
  return data ?? [];
}
export async function neonGetJualanGrosirByDateRange(start: string, end: string, userId?: string) {
  let data = await dataGet<any[]>(T.jualanGrosir, {
    select: "*",
    created_at: `gte.${start}`,
    order: "created_at.desc",
  });
  if (!data) data = [];
  data = (data as any[]).filter((r: any) => r.created_at <= end);
  if (userId) data = data.filter((r: any) => r.userId === userId);
  return data;
}
export async function neonGetJualanGrosirById(id: string) {
  const data = await dataGet<any[]>(T.jualanGrosir, { id: `eq.${id}`, select: "*" });
  if (Array.isArray(data) && data.length > 0) return data[0];
  throw new Error("Not found");
}
export async function neonCreateJualanGrosir(body: any) {
  const rows = await dataPost<any[]>(T.jualanGrosir, body);
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function neonUpdateJualanGrosir(id: string, body: any) {
  return dataPatch<any>(T.jualanGrosir, { id }, body);
}
export async function neonDeleteJualanGrosir(id: string) {
  await dataDelete(T.jualanGrosir, { id });
}

// Grosir payments (schema: id, jualanGrosirId, amount, paymentMethod, createdBy, userId, created_at)
export async function neonGetGrosirPaymentsByJualanGrosirId(jualanGrosirId: string) {
  const data = await dataGet<any[]>(T.grosirPayments, {
    select: "*",
    jualanGrosirId: `eq.${jualanGrosirId}`,
    order: "created_at.asc",
  });
  return data ?? [];
}
export async function neonGetGrosirPaymentsByDateRange(start: string, end: string) {
  let data = await dataGet<any[]>(T.grosirPayments, { select: "*", order: "created_at.desc" });
  if (!data) data = [];
  return (data as any[]).filter((r: any) => r.created_at >= start && r.created_at <= end);
}
export async function neonInsertGrosirPayment(body: any) {
  const rows = await dataPost<any[]>(T.grosirPayments, body);
  return Array.isArray(rows) ? rows[0] : rows;
}

// Grosir drafts (schema: id, createdBy, namaPelanggan, totalBelanja, setorAwal, status, created_at, updated_at)
export async function neonGetGrosirDrafts(userId?: string) {
  let data = await dataGet<any[]>(T.grosirDrafts, {
    select: "*",
    status: "eq.draft",
    order: "updated_at.desc",
  });
  if (!data) data = [];
  if (userId) data = (data as any[]).filter((r: any) => r.createdBy === userId);
  return data;
}
export async function neonGetGrosirDraftById(id: string) {
  const data = await dataGet<any[]>(T.grosirDrafts, { id: `eq.${id}`, select: "*" });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
// Grosir draft items (schema: id, grosirDraftId, barangId, barangNama, barangUnit, quantity, unitPrice, totalPrice)
export async function neonGetGrosirDraftItems(draftId: string) {
  const data = await dataGet<any[]>(T.grosirDraftItems, {
    select: "*",
    grosirDraftId: `eq.${draftId}`,
    order: "barangNama.asc",
  });
  return data ?? [];
}
export async function neonCreateGrosirDraft(body: any) {
  const { items, ...rest } = body;
  const payload = { ...rest, status: "draft" };
  const rows = await dataPost<any[]>(T.grosirDrafts, payload);
  const draft = Array.isArray(rows) ? rows[0] : rows;
  if (draft?.id && items?.length) {
    for (const it of items) {
      await dataPost(
        T.grosirDraftItems,
        {
          grosirDraftId: draft.id,
          barangId: it.barangId,
          barangNama: it.barangNama,
          barangUnit: it.barangUnit ?? "Pcs",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
        },
        ""
      );
    }
  }
  return draft;
}
export async function neonUpdateGrosirDraft(id: string, body: any) {
  const { items, ...rest } = body;
  await dataPatch(
    T.grosirDrafts,
    { id },
    {
      namaPelanggan: rest.namaPelanggan ?? "",
      totalBelanja: rest.totalBelanja,
      setorAwal: rest.setorAwal ?? 0,
    }
  );
  await dataDelete(T.grosirDraftItems, { grosirDraftId: id });
  if (items?.length) {
    for (const it of items) {
      await dataPost(
        T.grosirDraftItems,
        {
          grosirDraftId: id,
          barangId: it.barangId,
          barangNama: it.barangNama,
          barangUnit: it.barangUnit ?? "Pcs",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
        },
        ""
      );
    }
  }
  return neonGetGrosirDraftById(id);
}
export async function neonDeleteGrosirDraft(id: string) {
  await dataDelete(T.grosirDraftItems, { grosirDraftId: id });
  await dataDelete(T.grosirDrafts, { id });
}
