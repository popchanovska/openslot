import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { AvailabilityRule, Weekday } from '@teamlift/shared';

const WEEKDAY_INDEX: Record<Weekday, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** Host-local wall time ("2026-11-03", "16:00") → the UTC instant it means in `tz`. DST-aware. */
export function localToUtc(date: string, time: string, tz: string): Date {
  return fromZonedTime(`${date}T${time}:00`, tz);
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Iterates calendar dates as plain strings, so no clock arithmetic can drift across DST. */
function* plainDates(from: string, to: string) {
  const [y, m, d] = from.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const end = to;
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (iso > end) return;
    yield { iso, weekday: cursor.getUTCDay() };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

export const MAX_RULE_SLOTS = 300;

/**
 * Expands "every TUE and THU, Nov 1–30, 16:00–18:00, 30-minute sessions" into concrete slots.
 * Each slot's wall-clock time is converted on its own date, so 16:00 stays 16:00 after a clock change.
 */
export function expandRule(rule: AvailabilityRule, tz: string): { startAt: Date; endAt: Date }[] {
  const days = new Set(rule.weekdays.map((w) => WEEKDAY_INDEX[w]));
  const windowStart = toMinutes(rule.startTime);
  const windowEnd = toMinutes(rule.endTime);
  const out: { startAt: Date; endAt: Date }[] = [];

  for (const { iso, weekday } of plainDates(rule.dateFrom, rule.dateTo)) {
    if (!days.has(weekday)) continue;
    for (let t = windowStart; t + rule.sessionMinutes <= windowEnd; t += rule.sessionMinutes) {
      out.push({
        startAt: localToUtc(iso, fromMinutes(t), tz),
        endAt: localToUtc(iso, fromMinutes(t + rule.sessionMinutes), tz),
      });
      if (out.length > MAX_RULE_SLOTS) {
        throw new RangeError(`That would create more than ${MAX_RULE_SLOTS} slots. Try a shorter date range.`);
      }
    }
  }
  return out;
}

/** "Monday 26 October at 6:30 PM" in the host's zone, matching how the web app shows times. */
export function humanDateTime(date: Date, tz: string) {
  return formatInTimeZone(date, tz, "EEEE d MMMM 'at' h:mm a");
}

/** Today's date and weekday in the host's zone, e.g. for the LLM to resolve "next week". */
export function todayInZone(tz: string, now = new Date()) {
  return {
    date: formatInTimeZone(now, tz, 'yyyy-MM-dd'),
    weekday: formatInTimeZone(now, tz, 'EEEE'),
  };
}

/** Start of the current calendar month in the host's zone, as a UTC instant. */
export function monthBoundsInZone(tz: string, now = new Date()) {
  const ym = formatInTimeZone(now, tz, 'yyyy-MM');
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start: localToUtc(`${ym}-01`, '00:00', tz), end: localToUtc(`${next}-01`, '00:00', tz) };
}

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}
