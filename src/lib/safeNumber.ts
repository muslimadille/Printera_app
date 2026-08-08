/**
 * Safe numeric helpers for calculator engines + cost displays.
 * Incomplete inputs must never produce NaN/Infinity in the UI.
 */

/** Coerce unknown input to a finite number; '' / null / NaN → fallback. */
export function num(x: unknown, fallback = 0): number {
  if (x === '' || x == null || x === false) return fallback;
  if (typeof x === 'boolean') return fallback;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/** Return x if finite, else 0. */
export function finite(x: unknown): number {
  return num(x, 0);
}

/** a/b with zero-divisor and non-finite protection. */
export function safeDiv(a: unknown, b: unknown, fallback = 0): number {
  const na = num(a);
  const nb = num(b);
  if (nb === 0) return fallback;
  return finite(na / nb);
}

/** floor(a/b) safely — used for sheet packing counts. */
export function safeFloorDiv(a: unknown, b: unknown): number {
  const na = num(a);
  const nb = num(b);
  if (nb === 0 || na <= 0) return 0;
  return Math.max(0, Math.floor(na / nb));
}

/** How many small (w×h) rectangles fit in a large (W×H) sheet (both orientations). */
export function sheetsPerPurchase(W: unknown, H: unknown, w: unknown, h: unknown): number {
  const WW = num(W);
  const HH = num(H);
  const ww = num(w);
  const hh = num(h);
  if (WW <= 0 || HH <= 0 || ww <= 0 || hh <= 0) return 0;
  const o1 = safeFloorDiv(WW, ww) * safeFloorDiv(HH, hh);
  const o2 = safeFloorDiv(WW, hh) * safeFloorDiv(HH, ww);
  return Math.max(o1, o2);
}

/** Format money for display; non-finite → placeholder. */
export function formatMoney(x: unknown, digits = 2, empty = '—'): string {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return empty;
  return n.toFixed(digits);
}

/** True when a cost total is safe to show as a computed result. */
export function isFiniteMoney(...values: unknown[]): boolean {
  return values.every((v) => Number.isFinite(typeof v === 'number' ? v : Number(v)));
}

/** Sanitize every numeric field on a plain result object (shallow). */
export function sanitizeNumbers<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'number') out[k] = finite(v);
  }
  return out as T;
}
