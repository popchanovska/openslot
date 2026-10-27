import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent, InstructorSlot } from '@teamlift/shared';
import { DayKey, fmtDay, fmtRange, fmtTime, minutesIntoDay, todayKey, zoneLabel } from '../../lib/time';
import type { DayItem } from './CalendarBoard';

const HOUR_PX = 48;
const MIN_PX = HOUR_PX / 60;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Google Calendar's Day/Week view: an hourly grid where Google events, your open slots
 * and booked sessions sit as blocks at their real times, plus an all-day row on top.
 */
export function TimeGrid({
  days,
  tz,
  itemsByDay,
  selected,
  onSelectDay,
}: {
  days: DayKey[];
  tz: string;
  itemsByDay: Map<DayKey, DayItem[]>;
  selected: DayKey;
  onSelectDay: (day: DayKey) => void;
}) {
  const today = todayKey(tz);
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow();

  // Open scrolled to the morning, like Google does.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7.5 * HOUR_PX;
  }, []);

  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const allDay = days.map((d) => (itemsByDay.get(d) ?? []).filter((i) => i.kind === 'event' && i.event.allDay));
  const hasAllDay = allDay.some((list) => list.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-line">
      {/* Day headers */}
      <div className="grid shrink-0 border-b border-line bg-surface" style={{ gridTemplateColumns: cols }}>
        <div className="flex items-end justify-end pr-2 pb-1 text-[10px] text-muted">{zoneLabel(tz)}</div>
        {days.map((d) => {
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(d)}
              aria-pressed={d === selected}
              className={`flex flex-col items-center gap-0.5 border-l border-line py-2 transition-colors hover:bg-brand-tint ${d === selected ? 'bg-brand-tint' : ''}`}
            >
              <span className={`text-[11px] font-medium tracking-wide uppercase ${isToday ? 'text-brand' : 'text-muted'}`}>
                {fmtDay(d, 'EEE')}
              </span>
              <span
                className={`grid size-9 place-items-center text-xl ${isToday ? 'bg-brand font-medium text-white' : 'text-ink'}`}
              >
                {Number(d.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div className="pt-1 pr-2 text-right text-[10px] text-muted">all day</div>
          {allDay.map((list, i) => (
            <div key={days[i]} className="flex min-w-0 flex-col gap-0.5 border-l border-line p-1">
              {list.map((item) =>
                item.kind === 'event' ? (
                  <span key={item.event.id} title={item.event.title} className={`truncate  px-1.5 py-0.5 text-[11px] font-medium ${eventTone(item.event)}`}>
                    {item.event.title}
                  </span>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hour grid */}
      <div ref={scroller} className="min-h-[360px] flex-1 overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR_PX }}>
          {/* Hour labels */}
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted" style={{ top: h * HOUR_PX }}>
                {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </span>
            ))}
          </div>

          {days.map((d) => {
            const timed = (itemsByDay.get(d) ?? []).filter((i) => !(i.kind === 'event' && i.event.allDay));
            const placed = layout(timed, d, tz);
            return (
              <div
                key={d}
                className={`relative border-l border-line ${d < today ? 'bg-cell/60' : ''}`}
                onClick={() => onSelectDay(d)}
              >
                {HOURS.slice(1).map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_PX }} />
                ))}
                {placed.map(({ item, top, height, col, cols: n }) => (
                  <Block
                    key={item.kind === 'slot' ? item.slot.id : item.event.id}
                    item={item}
                    tz={tz}
                    style={{
                      top: top * MIN_PX,
                      height: Math.max(height * MIN_PX - 2, 18),
                      left: `calc(${(col / n) * 100}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                    }}
                    onClick={() => onSelectDay(d)}
                  />
                ))}
                {d === today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: minutesIntoDay(now.toISOString(), d, tz) * MIN_PX }}>
                    <div className="relative h-0.5 bg-[#ea4335]">
                      <span className="absolute -top-[5px] -left-[6px] size-3 rounded-full bg-[#ea4335]" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Block({
  item,
  tz,
  style,
  onClick,
}: {
  item: DayItem;
  tz: string;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const { start, end } = bounds(item);
  const short = new Date(end).getTime() - new Date(start).getTime() <= 30 * 60_000;
  let title: string;
  let tone: string;
  if (item.kind === 'event') {
    title = item.event.title;
    tone = eventTone(item.event);
  } else {
    const s = item.slot;
    title = s.booking ? s.booking.name : s.clash ? 'Open · clash' : 'Open slot';
    tone = slotTone(s);
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${title}, ${fmtRange(start, end, tz)}`}
      className={`absolute z-[1] overflow-hidden rounded-md px-1.5 text-left leading-tight shadow-[0_0_0_1px_white] ${tone} ${short ? 'py-0.5' : 'py-1'}`}
      style={style}
    >
      {short ? (
        <span className="block truncate text-[11px]">
          <span className="font-medium">{title}</span>, {fmtTime(start, tz)}
        </span>
      ) : (
        <>
          <span className="block truncate text-[12px] font-medium">{title}</span>
          <span className="block truncate text-[11px] opacity-90">{fmtRange(start, end, tz)}</span>
        </>
      )}
    </button>
  );
}

/** Google's default event colour; "Free" events are drawn lighter, like in Google. */
export const eventTone = (e: CalendarEvent) =>
  e.busy ? 'bg-gcal text-white hover:brightness-95' : 'border border-gcal bg-gcal-soft text-gcal-ink';

const slotTone = (s: InstructorSlot) =>
  s.booking
    ? 'bg-brand text-white hover:bg-brand-hover'
    : s.clash
      ? 'border border-dashed border-warn bg-warn-soft text-[#9a4f12]'
      : 'border border-dashed border-brand bg-brand-tint text-brand hover:bg-brand-soft';

function bounds(item: DayItem) {
  return item.kind === 'slot'
    ? { start: item.slot.startAt, end: item.slot.endAt }
    : { start: item.event.start, end: item.event.end };
}

/**
 * Side-by-side columns for overlapping blocks (what Google does when two events overlap):
 * blocks that overlap in a chain share one cluster and split its width.
 */
function layout(items: DayItem[], day: DayKey, tz: string) {
  const blocks = items
    .map((item) => {
      const { start, end } = bounds(item);
      const top = minutesIntoDay(start, day, tz);
      return { item, top, height: Math.max(minutesIntoDay(end, day, tz) - top, 15), col: 0, cols: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  let cluster: typeof blocks = [];
  let clusterEnd = -1;
  const columnsEnd: number[] = [];
  const flush = () => {
    const n = Math.max(1, columnsEnd.length);
    cluster.forEach((b) => (b.cols = n));
    cluster = [];
    columnsEnd.length = 0;
  };
  for (const b of blocks) {
    if (b.top >= clusterEnd) flush();
    let col = columnsEnd.findIndex((end) => end <= b.top);
    if (col === -1) col = columnsEnd.length;
    columnsEnd[col] = b.top + b.height;
    b.col = col;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.top + b.height);
  }
  flush();
  return blocks;
}

/** Re-renders every minute so the red "now" line moves. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
