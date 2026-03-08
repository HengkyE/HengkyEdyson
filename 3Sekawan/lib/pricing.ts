/**
 * Billiard pricing rules and helpers.
 *
 * Slot A (13:00–18:44):
 *  - Tables 1–8:  20k / hour
 *  - Tables 9–13: 30k / hour
 *  - Tables 14–17: 40k / hour
 *
 * Slot B (18:45–02:59, including after midnight until 03:00):
 *  - Tables 1–8:  30k / hour
 *  - Tables 9–13: 40k / hour
 *  - Tables 14–17: 50k / hour
 */

function getTableTier(tableNumber: number): 1 | 2 | 3 {
  if (tableNumber >= 1 && tableNumber <= 8) return 1;
  if (tableNumber >= 9 && tableNumber <= 13) return 2;
  return 3;
}

function isSlotB(date: Date): boolean {
  const hour = date.getHours();
  const minute = date.getMinutes();
  // Evening slot: 18:45–23:59 and 00:00–02:59
  return hour < 3 || hour > 18 || (hour === 18 && minute >= 45);
}

export function getRatePerHour(tableNumber: number, atTime: Date = new Date()): number {
  const tier = getTableTier(tableNumber);
  const slotB = isSlotB(atTime);

  if (!slotB) {
    // Slot A: 13:00–18:44
    switch (tier) {
      case 1:
        return 20000;
      case 2:
        return 30000;
      case 3:
      default:
        return 40000;
    }
  }

  // Slot B: 18:45–02:59
  switch (tier) {
    case 1:
      return 30000;
    case 2:
      return 50000;
    case 3:
    default:
      return 60000;
  }
}

/**
 * Calculate billiard amount by splitting a session into slot-based segments.
 * Billing is applied in 30-minute chunks so prices stay aligned with half-hour charging.
 */
export function calculateBilliardAmount(tableNumber: number, startAt: Date, endAt: Date): number {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  const HALF_HOUR_MS = 30 * 60 * 1000;
  let total = 0;
  let cursorMs = startMs;
  let guard = 0;

  while (cursorMs < endMs && guard < 1000) {
    guard += 1;
    const chunkEndMs = Math.min(cursorMs + HALF_HOUR_MS, endMs);
    const chunkHours = (chunkEndMs - cursorMs) / 3_600_000;
    const rate = getRatePerHour(tableNumber, new Date(cursorMs));
    total += chunkHours * rate;
    cursorMs = chunkEndMs;
  }

  return Math.round(total);
}

export interface BilliardPricingBreakdownItem {
  hours: number;
  ratePerHour: number;
  amount: number;
}

/**
 * Return per-segment pricing lines grouped by consecutive equal rates.
 * Example across slot change: 0.5h x 20k, 0.5h x 30k.
 */
export function getBilliardPricingBreakdown(
  tableNumber: number,
  startAt: Date,
  endAt: Date,
): BilliardPricingBreakdownItem[] {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const HALF_HOUR_MS = 30 * 60 * 1000;
  const items: BilliardPricingBreakdownItem[] = [];

  let cursorMs = startMs;
  let guard = 0;
  while (cursorMs < endMs && guard < 1000) {
    guard += 1;
    const chunkEndMs = Math.min(cursorMs + HALF_HOUR_MS, endMs);
    const chunkHours = (chunkEndMs - cursorMs) / 3_600_000;
    const ratePerHour = getRatePerHour(tableNumber, new Date(cursorMs));
    const amount = Math.round(chunkHours * ratePerHour);

    const last = items[items.length - 1];
    if (last && last.ratePerHour === ratePerHour) {
      last.hours = Math.round((last.hours + chunkHours) * 100) / 100;
      last.amount += amount;
    } else {
      items.push({
        hours: Math.round(chunkHours * 100) / 100,
        ratePerHour,
        amount,
      });
    }

    cursorMs = chunkEndMs;
  }

  return items;
}
