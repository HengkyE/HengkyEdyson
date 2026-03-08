/**
 * Date formatting utilities for Indonesian locale.
 * All displayed dates/times use Asia/Jakarta (UTC+7) so users see consistent times regardless of device timezone.
 */

export const APP_TIMEZONE = "Asia/Jakarta";

const INTL_OPTS = { timeZone: APP_TIMEZONE, locale: "id-ID" };

/**
 * Format date to Indonesian format (Jakarta time)
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "Selasa, 30 Desember 2025")
 */
export function formatDateIndo(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

/**
 * Format date and time to Indonesian format (Jakarta time)
 * @param date - Date object or ISO string
 * @returns Formatted date and time string
 */
export function formatDateTimeIndo(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const dateStr = new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
  const timeStr = new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Get current date in Indonesian format (Jakarta time)
 */
export function getCurrentDateIndo(): string {
  return formatDateIndo(new Date());
}

/**
 * Get current date and time in Indonesian format (Jakarta time)
 */
export function getCurrentDateTimeIndo(): string {
  return formatDateTimeIndo(new Date());
}

/**
 * Format date to Indonesian format for receipts (compact, Jakarta time)
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "30 Des 2025, 14:30")
 */
export function formatDateID(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const dateStr = new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dateObj);
  const timeStr = new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Get calendar date parts (year, month, day) in Jakarta for a given instant.
 */
export function getJakartaDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Return YYYY-MM-DD for the given instant in Jakarta.
 */
export function getJakartaYYYYMMDD(date: Date): string {
  const { year, month, day } = getJakartaDateParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Create a Date (UTC) for a given local moment in Jakarta.
 * Month is 1-based (1 = January).
 */
export function getJakartaMoment(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date {
  const s = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+07:00`;
  return new Date(s);
}

/**
 * Start of the given calendar day in Jakarta (00:00:00.000) as UTC Date.
 */
export function getJakartaStartOfDay(date: Date): Date {
  const { year, month, day } = getJakartaDateParts(date);
  return getJakartaMoment(year, month, day, 0, 0, 0);
}

/**
 * End of the given calendar day in Jakarta (23:59:59.999) as UTC Date.
 */
export function getJakartaEndOfDay(date: Date): Date {
  const { year, month, day } = getJakartaDateParts(date);
  return new Date(getJakartaMoment(year, month, day, 23, 59, 59).getTime() + 999);
}

/**
 * Current "operational day" in Jakarta: 12:00–05:00 next day.
 * If current Jakarta time is before 05:00, returns the previous calendar day.
 */
export function getOperationalDayInJakarta(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);
  let y = get("year"),
    m = get("month"),
    d = get("day");
  const h = get("hour");
  if (h < 5) {
    const prev = new Date(y, m - 1, d - 1);
    y = prev.getFullYear();
    m = prev.getMonth() + 1;
    d = prev.getDate();
  }
  return getJakartaMoment(y, m, d, 0, 0, 0);
}

/**
 * Format time only in Jakarta (e.g. for "Dari 14.00 -> 16.00").
 */
export function formatTimeJakarta(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    ...INTL_OPTS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

/**
 * Parse "YYYY-MM-DD" as that calendar day in Jakarta; returns start of that day (00:00) in Jakarta as UTC Date.
 */
export function parseDateAsJakarta(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return getJakartaMoment(y, m, d, 0, 0, 0);
}

/**
 * Add N calendar days in Jakarta to the given date; returns start of that day in Jakarta.
 */
export function addDaysInJakarta(date: Date, days: number): Date {
  const { year, month, day } = getJakartaDateParts(date);
  const atNoon = getJakartaMoment(year, month, day, 12, 0, 0);
  const next = new Date(atNoon.getTime() + days * 24 * 60 * 60 * 1000);
  const p = getJakartaDateParts(next);
  return getJakartaMoment(p.year, p.month, p.day, 0, 0, 0);
}
