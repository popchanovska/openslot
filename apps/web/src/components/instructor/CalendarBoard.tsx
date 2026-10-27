import { ReactNode, useMemo, useState } from 'react';
import { CalendarEvent, InstructorCalendarResponse, InstructorSlot } from '@teamlift/shared';
import { useDeleteSlot, useInstructorCalendar } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import {
  DayKey,
  dayStartUtc,
  fmtDay,
  fmtMonth,
  fmtRange,
  fmtTime,
  groupByDay,
  inMonth,
  monthGrid,
  monthOf,
  nextDay,
  shiftDay,
  shiftMonth,
  todayKey,
  weekOf,
  WEEKDAY_LABELS,
} from '../../lib/time';
import { Button, Notice } from '../ui';
import { eventTone, TimeGrid } from './TimeGrid';

const MAX_CHIPS = 3;
type View = 'day' | 'week' | 'month';

/** One entry in a day: a slot of yours, or an event from Google Calendar. */
export type DayItem = { kind: 'slot'; slot: InstructorSlot; sort: string } | { kind: 'event'; event: CalendarEvent; sort: string };

/**
 * The instructor workspace, laid out like Google Calendar: a sidebar on the left (the tools
 * passed in, then the selected day's details) and the calendar filling the rest of the screen.
 */
export function CalendarBoard({ tz, sidebar }: { tz: string; sidebar: ReactNode }) {
  const today = todayKey(tz);
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<DayKey>(today); // the day the view is built around
  const [selected, setSelected] = useState<DayKey>(today);

  const month = monthOf(anchor);
  const days = view === 'day' ? [anchor] : view === 'week' ? weekOf(anchor) : monthGrid(month);
  const from = dayStartUtc(days[0], tz);
  const to = dayStartUtc(nextDay(days[days.length - 1]), tz);
  const calendar = useInstructorCalendar(from, to);

  const itemsByDay = useMemo(() => buildDays(calendar.data, days, tz), [calendar.data, days.join(), tz]);

  const go = (delta: number) => {
    const next =
      view === 'day'
        ? shiftDay(anchor, delta)
        : view === 'week'
          ? shiftDay(anchor, delta * 7)
          : (() => {
              const m = shiftMonth(month, delta);
              return `${m.year}-${String(m.month + 1).padStart(2, '0')}-01`;
            })();
    setAnchor(next);
    setSelected(view === 'week' ? weekOf(next)[0] : next);
  };
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  return (
    <div className="grid lg:h-full lg:grid-cols-[340px_1fr]">
      <aside className="border-b border-line bg-surface lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        {sidebar}
        <DayDetail day={selected} tz={tz} items={itemsByDay.get(selected) ?? []} loading={calendar.isPending} />
      </aside>

      <section className="flex min-h-[640px] flex-col bg-surface lg:min-h-0" aria-label="Calendar">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" className="border border-line text-ink" onClick={goToday}>
            Today
          </Button>
          <NavButton dir="left" onClick={() => go(-1)} label={`Previous ${view}`} />
          <NavButton dir="right" onClick={() => go(1)} label={`Next ${view}`} />
          <h2 className="ml-1 text-lg text-ink">{rangeTitle(view, days, anchor)}</h2>
          <Legend />
          <div className="ml-auto flex border border-line text-[13px]" role="tablist" aria-label="Calendar view">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  setAnchor(selected);
                }}
                className={`px-3 py-1.5 capitalize transition-colors ${view === v ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:text-ink'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {(calendar.data?.google.error || calendar.error) && (
          <div className="px-4 pt-3 sm:px-6">
            {calendar.data?.google.error && <Notice tone="warn">Calendar sync is paused: {calendar.data.google.error}</Notice>}
            {calendar.error && <Notice tone="error">{errorMessage(calendar.error)}</Notice>}
          </div>
        )}

        <div className={`flex min-h-0 flex-1 flex-col p-3 transition-opacity sm:p-4 ${calendar.isFetching && !calendar.isPending ? 'opacity-70' : ''}`}>
          {view === 'month' ? (
            <MonthGrid days={days} month={month} today={today} selected={selected} tz={tz} itemsByDay={itemsByDay} onSelect={setSelected} />
          ) : (
            <TimeGrid days={days} tz={tz} itemsByDay={itemsByDay} selected={selected} onSelectDay={setSelected} />
          )}
        </div>
      </section>
    </div>
  );
}

function rangeTitle(view: View, days: DayKey[], anchor: DayKey) {
  if (view === 'day') return fmtDay(anchor, 'EEEE, MMMM d, yyyy');
  if (view === 'month') return fmtMonth(monthOf(anchor));
  const [first, last] = [days[0], days[days.length - 1]];
  if (first.slice(0, 7) === last.slice(0, 7)) return fmtDay(first, 'MMMM yyyy');
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `${fmtDay(first, sameYear ? 'MMM' : 'MMM yyyy')} – ${fmtDay(last, 'MMM yyyy')}`;
}

function NavButton({ dir, onClick, label }: { dir: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-8 place-items-center text-ink/70 hover:bg-cell">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Puts slots and Google events on the days they touch. A connection made before event access
 * existed only has free/busy, so those blocks show as untitled "Busy" events.
 */
function buildDays(data: InstructorCalendarResponse | undefined, days: DayKey[], tz: string) {
  const map = new Map<DayKey, DayItem[]>();
  if (!data) return map;

  const events: CalendarEvent[] = data.google.showsEvents
    ? data.events
    : data.busy.map((b) => ({ id: b.start, title: 'Busy', start: b.start, end: b.end, allDay: false, busy: true, link: null }));

  const slotsByDay = groupByDay(data.slots, tz);
  for (const day of days) {
    const dayStart = dayStartUtc(day, tz).getTime();
    const dayEnd = dayStartUtc(nextDay(day), tz).getTime();
    const items: DayItem[] = (slotsByDay.get(day) ?? []).map((slot) => ({ kind: 'slot', slot, sort: slot.startAt }));
    for (const event of events) {
      const touches = event.allDay
        ? event.start.slice(0, 10) <= day && day < event.end.slice(0, 10)
        : new Date(event.start).getTime() < dayEnd && new Date(event.end).getTime() > dayStart;
      if (touches) items.push({ kind: 'event', event, sort: event.allDay ? '' : event.start });
    }
    if (items.length) map.set(day, items.sort((a, b) => a.sort.localeCompare(b.sort)));
  }
  return map;
}

function Legend() {
  const item = (dot: string, label: string) => (
    <li className="flex items-center gap-1.5">
      <span className={`size-2 ${dot}`} aria-hidden />
      {label}
    </li>
  );
  return (
    <ul className="ml-4 hidden flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted xl:flex">
      {item('border border-dashed border-brand', 'Open slot')}
      {item('bg-brand', 'Booked')}
      {item('bg-gcal', 'Google Calendar')}
      {item('bg-warn', 'Clash')}
    </ul>
  );
}

/* ---------- Month view ---------- */

function MonthGrid({
  days,
  month,
  today,
  selected,
  tz,
  itemsByDay,
  onSelect,
}: {
  days: DayKey[];
  month: ReturnType<typeof monthOf>;
  today: DayKey;
  selected: DayKey;
  tz: string;
  itemsByDay: Map<DayKey, DayItem[]>;
  onSelect: (d: DayKey) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border border-line">
      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] tracking-[0.06em] text-muted uppercase" aria-hidden>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map((key) => (
          <DayCell
            key={key}
            day={key}
            tz={tz}
            items={itemsByDay.get(key) ?? []}
            outside={!inMonth(key, month)}
            isToday={key === today}
            isPast={key < today}
            isSelected={key === selected}
            onSelect={() => onSelect(key)}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day,
  tz,
  items,
  outside,
  isToday,
  isPast,
  isSelected,
  onSelect,
}: {
  day: DayKey;
  tz: string;
  items: DayItem[];
  outside: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const shown = items.slice(0, MAX_CHIPS);
  const more = items.length - shown.length;
  const slots = items.filter((i) => i.kind === 'slot').length;

  return (
    <button
      type="button"
      // Days from neighbouring months are shown for context only; use the arrows to go there.
      disabled={outside}
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${fmtDay(day)}: ${slots} slots, ${items.length - slots} calendar events`}
      className={`flex min-h-0 min-w-0 flex-col items-stretch gap-0.5 overflow-hidden border-r border-b border-line p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0 ${
        outside ? 'cursor-default bg-surface text-faint' : isSelected ? 'bg-brand-tint' : isPast ? 'bg-cell/60 hover:bg-cell' : 'bg-surface hover:bg-cell'
      }`}
    >
      <span className={`mb-0.5 self-center px-1.5 text-[12px] ${isToday ? 'bg-brand font-medium text-white' : outside ? 'text-faint' : 'text-ink'}`}>
        {Number(day.slice(8))}
      </span>
      {!outside &&
        shown.map((item) =>
          item.kind === 'slot' ? <SlotChip key={item.slot.id} slot={item.slot} tz={tz} /> : <EventChip key={item.event.id} event={item.event} tz={tz} />,
        )}
      {!outside && more > 0 && <span className="pl-1 text-[11px] text-muted">+{more} more</span>}
    </button>
  );
}

function SlotChip({ slot, tz }: { slot: InstructorSlot; tz: string }) {
  const time = fmtTime(slot.startAt, tz);
  if (slot.booking) {
    return (
      <span className="truncate bg-brand px-1.5 py-0.5 text-[11px] text-white">
        {time} {slot.booking.name.split(' ')[0]}
      </span>
    );
  }
  return (
    <span
      className={`truncate border border-dashed px-1.5 py-px text-[11px] ${slot.clash ? 'border-warn bg-warn-soft text-[#9a4f12]' : 'border-brand bg-brand-tint text-brand'}`}
    >
      {time}
    </span>
  );
}

/** Google's month view: all-day events as a filled bar, timed ones as a marker, time and title. */
function EventChip({ event, tz }: { event: CalendarEvent; tz: string }) {
  if (event.allDay) {
    return (
      <span title={event.title} className={`truncate px-1.5 py-0.5 text-[11px] font-medium ${eventTone(event)}`}>
        {event.title}
      </span>
    );
  }
  return (
    <span title={event.title} className="flex min-w-0 items-center gap-1 px-1 py-px text-[11px] text-ink/80">
      <span className={`size-1.5 shrink-0 ${event.busy ? 'bg-gcal' : 'border border-gcal'}`} aria-hidden />
      <span className="truncate">
        {fmtTime(event.start, tz)} {event.title}
      </span>
    </span>
  );
}

/* ---------- Selected day (sidebar) ---------- */

function DayDetail({ day, tz, items, loading }: { day: DayKey; tz: string; items: DayItem[]; loading: boolean }) {
  const remove = useDeleteSlot();
  const now = Date.now();

  return (
    <div className="p-5" aria-live="polite">
      <h3 className="text-[15px] font-medium text-ink">{fmtDay(day)}</h3>
      {loading ? (
        <div className="mt-3 h-16 animate-pulse bg-cell" aria-hidden />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing on this day.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {items.map((item) => {
            if (item.kind === 'event') {
              const e = item.event;
              return (
                <li key={e.id} className={`flex items-start gap-2.5 py-2.5 ${e.busy ? '' : 'opacity-70'}`}>
                  <span className="mt-1.5 size-2 shrink-0 bg-gcal" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{e.title}</p>
                    <p className="text-[12px] text-muted">{e.allDay ? 'All day' : fmtRange(e.start, e.end, tz)} · Google Calendar</p>
                  </div>
                  {e.link && (
                    <a href={e.link} target="_blank" rel="noreferrer" className="text-[12px] text-brand hover:underline">
                      Open
                    </a>
                  )}
                </li>
              );
            }
            const s = item.slot;
            const past = new Date(s.endAt).getTime() < now;
            return (
              <li key={s.id} className={`flex items-start gap-2.5 py-2.5 ${past ? 'opacity-60' : ''}`}>
                <span
                  className={`mt-1.5 size-2 shrink-0 ${s.booking ? 'bg-brand' : s.clash ? 'bg-warn' : 'border border-dashed border-brand'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {s.booking ? (
                    <>
                      <p className="truncate text-sm text-ink">{s.booking.name}</p>
                      <p className="truncate text-[12px] text-muted">
                        {fmtRange(s.startAt, s.endAt, tz)} ·{' '}
                        <a href={`mailto:${s.booking.email}`} className="text-brand hover:underline">
                          {s.booking.email}
                        </a>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-ink">{s.clash ? 'Open slot (clash)' : 'Open slot'}</p>
                      <p className="text-[12px] text-muted">
                        {fmtRange(s.startAt, s.endAt, tz)}
                        {s.clash && ' · hidden from clients'}
                      </p>
                    </>
                  )}
                </div>
                {!s.booking && !past && (
                  <button
                    type="button"
                    className="text-[12px] text-muted hover:text-danger"
                    disabled={remove.isPending && remove.variables === s.id}
                    onClick={() => remove.mutate(s.id)}
                    aria-label={`Remove the ${fmtTime(s.startAt, tz)} slot`}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {remove.error && (
        <div className="mt-3">
          <Notice tone="error">{errorMessage(remove.error)}</Notice>
        </div>
      )}
    </div>
  );
}
