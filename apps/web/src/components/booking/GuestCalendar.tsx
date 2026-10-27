import type { PublicSlot } from '@teamlift/shared';
import { DayKey, fmtDay, fmtMonth, inMonth, Month, monthGrid, WEEKDAY_LABELS } from '../../lib/time';
import { MonthNav } from '../MonthNav';

interface Props {
  month: Month;
  onMonthChange: (m: Month) => void;
  canGoBack: boolean;
  byDay: Map<DayKey, PublicSlot[]>;
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
  today: DayKey;
}

/**
 * Month grid with round day markers. The rows share the available height, and the circles
 * scale with the window, so the whole month fits on screen without scrolling.
 */
export function GuestCalendar({ month, onMonthChange, canGoBack, byDay, selected, onSelect, today }: Props) {
  const cells = monthGrid(month);
  const weeks = cells.length / 7;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">{fmtMonth(month)}</h2>
        <MonthNav month={month} onChange={onMonthChange} canGoBack={canGoBack} />
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-[11px] tracking-[0.06em] text-muted uppercase" aria-hidden>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div
        className="mt-2 grid min-h-[300px] flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {cells.map((key) => {
          if (!inMonth(key, month)) return <div key={key} aria-hidden />;
          const slots = byDay.get(key) ?? [];
          const open = slots.filter((s) => s.status === 'available').length;
          const isSelected = key === selected;
          const isToday = key === today;
          const interactive = slots.length > 0;

          const tone = isSelected
            ? 'bg-brand text-white'
            : open > 0
              ? 'bg-brand-soft text-brand font-medium hover:bg-[#dbe0f8]'
              : interactive
                ? 'text-ink/70 hover:bg-cell'
                : 'text-faint';

          return (
            <div key={key} className="flex flex-col items-center justify-center">
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect(key)}
                aria-pressed={isSelected}
                aria-label={`${fmtDay(key)}${open ? `, ${open} open` : interactive ? ', fully booked' : ', no sessions'}`}
                className={`grid size-[clamp(34px,6.4vh,56px)] place-items-center rounded-full text-[15px] transition-colors ${tone} ${
                  isToday && !isSelected ? 'font-semibold text-ink' : ''
                } disabled:cursor-default`}
              >
                {Number(key.slice(8))}
              </button>
              <span className={`mt-0.5 size-1 rounded-full ${isToday ? 'bg-muted' : 'bg-transparent'}`} aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
  );
}
