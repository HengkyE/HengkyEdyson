export type ScannedBarcodePayload = {
  barcode: string;
  returnTo?: string;
};

type Listener = (payload: ScannedBarcodePayload) => void;

const listeners = new Set<Listener>();

/**
 * In-memory event bus for barcode scans.
 * This avoids route "replace" navigation (which can remount screens and reset cart state).
 *
 * Note: This is intentionally ephemeral (not persisted). It's meant for immediate handoff
 * from a barcode scanner back to the originating screen (e.g. when/if a scan flow is re-added).
 */
export function emitScannedBarcode(payload: ScannedBarcodePayload) {
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeScannedBarcode(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

