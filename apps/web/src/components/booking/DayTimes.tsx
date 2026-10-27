import type { PublicSlot } from '@teamlift/shared';
import { DayKey, fmtDay, fmtTime } from '../../lib/time';

export function DayTimes({
  day,
  slots,
  tz,
  onPick,
  anyOpen,
}: {
  day: DayKey | null;
  slots: PublicSlot[];
  tz: string;
  onPick: (slot: PublicSlot) => void;
  anyOpen: boolean;
}) {
  if (!day) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        {anyOpen ? 'Pick a highlighted date to see open times.' : 'No open times right now. New slots are added every week, so check back soon.'}
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="font-medium text-ink">{fmtDay(day)}</h3>
      {slots.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No sessions on this day.</p>
      ) : (
        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {slots.map((s) =>
            s.status === 'available' ? (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="h-11 w-full rounded-lg border border-brand bg-surface text-[15px] font-medium text-brand transition-colors hover:bg-brand-tint"
                >
                  {fmtTime(s.startAt, tz)}
                </button>
              </li>
            ) : (
              <li
                key={s.id}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-faint"
                aria-label={`${fmtTime(s.startAt, tz)}, unavailable`}
              >
                <span className="text-[15px] line-through">{fmtTime(s.startAt, tz)}</span>
                <span className="text-[11px] line-through">Unavailable</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
