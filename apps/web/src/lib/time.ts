import { addDays, format, getDaysInMonth, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Calendar days are plain "yyyy-MM-dd" strings in the host's zone, never browser-local dates. */
export type DayKey = string;

export const dayKeyOf = (iso: string | Date, tz: string): DayKey => formatInTimeZone(iso, tz, 'yyyy-MM-dd');
export const todayKey = (tz: string): DayKey => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

export const fmtTime = (iso: string, tz: string) => formatInTimeZone(iso, tz, 'h:mm a');
export const fmtRange = (start: string, end: string, tz: string) => `${fmtTime(start, tz)} – ${fmtTime(end, tz)}`;

/** Formatting a DayKey: parse as a naive date, since the key is already in the host's zone. */
export const fmtDay = (key: DayKey, pattern = 'EEEE, MMMM d') => format(parseISO(key), pattern);

/** Midnight at the start of `key` in the host's zone, as a UTC instant. */
export const dayStartUtc = (key: DayKey, tz: string) => fromZonedTime(`${key}T00:00:00`, tz);
export const nextDay = (key: DayKey): DayKey => format(addDays(parseISO(key), 1), 'yyyy-MM-dd');
export const shiftDay = (key: DayKey, days: number): DayKey => format(addDays(parseISO(key), days), 'yyyy-MM-dd');

/** The Monday-first week containing `key`, as 7 DayKeys. */
export function weekOf(key: DayKey): DayKey[] {
  const d = parseISO(key);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
}

/** Minutes from the start of `day` (host zone) to `iso`, clamped to the day. DST-safe. */
export function minutesIntoDay(iso: string, day: DayKey, tz: string) {
  const start = dayStartUtc(day, tz).getTime();
  const end = dayStartUtc(nextDay(day), tz).getTime();
  const t = Math.min(Math.max(new Date(iso).getTime(), start), end);
  return (t - start) / 60_000;
}

/** "GMT+01" for the zone today, like the corner label in Google Calendar. */
export const zoneLabel = (tz: string) => formatInTimeZone(new Date(), tz, "'GMT'xxx").replace(':00', '');

export interface Month {
  year: number;
  month: number; // 0-based
}

export const monthOf = (key: DayKey): Month => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });
export const monthKey = (m: Month) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
export const shiftMonth = (m: Month, delta: number): Month => {
  const d = new Date(m.year, m.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
export const fmtMonth = (m: Month) => format(new Date(m.year, m.month, 1), 'MMMM yyyy');

/** Monday-first weeks covering the month, as DayKeys (leading/trailing days from neighbouring months). */
export function monthGrid(m: Month): DayKey[] {
  const first = new Date(m.year, m.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Math.ceil((offset + getDaysInMonth(first)) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => format(new Date(m.year, m.month, 1 - offset + i), 'yyyy-MM-dd'));
}

export const inMonth = (key: DayKey, m: Month) => key.startsWith(monthKey(m));

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function groupByDay<T extends { startAt: string }>(items: T[], tz: string) {
  const map = new Map<DayKey, T[]>();
  for (const item of items) {
    const key = dayKeyOf(item.startAt, tz);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
