/** Formatting helpers for catalogue numbers, dates and coordinates. */

export const pad = (n: number, w = 3) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

/** "Plate 007" style number (just the digits). */
export const plateNo = (n: number) => pad(n, 3);

/** "Q·07" style question number (just the digits). */
export const questionNo = (n: number) => pad(n, 2);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

/** "2026·10·25" — catalogue style. */
export function dateMono(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '·');
}

/** "25 October 2026" — reading style. */
export function dateLong(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "25 Oct 2026". */
export function dateShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "2026-10" month key from a date. */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** "October 2026" from a month key. */
export function monthLong(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Oct" or "Oct 26" labels for chart axes. */
export function monthAxis(key: string, withYear = false): string {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `${MONTHS_SHORT[m - 1]} ’${String(y).slice(2)}` : MONTHS_SHORT[m - 1];
}

/** Every month key from `from` to `to` inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${pad(m, 2)}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 1200) break; // safety
  }
  return out;
}

/** Time of day "14:22" from an ISO timestamp. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
}

/** Roman numerals for section and figure labels. */
export function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Signed, zero-padded chart coordinate: "+0240" / "−0120". */
export function coord(v: number): string {
  const s = v < 0 ? '−' : '+';
  return s + pad(Math.abs(Math.round(v)), 4);
}

/** Byte counts for storage readouts. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
