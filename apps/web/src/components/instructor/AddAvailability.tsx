import { FormEvent, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { AvailabilityRule, SlotPreviewItem, SlotPreviewResponse } from '@teamlift/shared';
import { useBulkCreate, useCreateSlot, useParseAvailability } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { dayKeyOf, fmtDay, fmtTime, groupByDay, todayKey } from '../../lib/time';
import { Button, Field, inputClass, Notice } from '../ui';

type Mode = 'describe' | 'manual';

export function AddAvailability({ tz, sessionMinutes }: { tz: string; sessionMinutes: number }) {
  const [mode, setMode] = useState<Mode>('describe');
  const [done, setDone] = useState<string | null>(null);

  return (
    <section className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-ink">Add availability</h2>
        <div className="flex border border-line text-[12px]" role="tablist" aria-label="How to add slots">
          {(['describe', 'manual'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setDone(null);
              }}
              className={`px-2.5 py-1 transition-colors ${mode === m ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:text-ink'}`}
            >
              {m === 'describe' ? 'Describe' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {mode === 'describe' ? (
          <DescribeMode tz={tz} onDone={setDone} />
        ) : (
          <ManualMode tz={tz} sessionMinutes={sessionMinutes} onDone={setDone} />
        )}
      </div>

      {done && (
        <div className="mt-4">
          <Notice tone="ok" onDismiss={() => setDone(null)}>
            {done}
          </Notice>
        </div>
      )}
    </section>
  );
}

/* ---------- Describe: text → AI rule → preview → confirm ---------- */

function DescribeMode({ tz, onDone }: { tz: string; onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const parse = useParseAvailability();
  const bulk = useBulkCreate();
  const [preview, setPreview] = useState<SlotPreviewResponse | null>(null);

  const toCreate = preview?.slots.filter((s) => s.issue !== 'past' && s.issue !== 'overlap') ?? [];
  const skipped = (preview?.slots.length ?? 0) - toCreate.length;

  const runPreview = (e: FormEvent) => {
    e.preventDefault();
    onDone('');
    parse.mutate(text, { onSuccess: setPreview });
  };

  const save = () =>
    bulk.mutate(
      toCreate.map(({ startAt, endAt }) => ({ startAt, endAt })),
      {
        onSuccess: (res) => {
          setPreview(null);
          setText('');
          const skippedNow = res.skipped.length ? ` ${res.skipped.length} skipped because they overlap or already passed.` : '';
          onDone(`Added ${res.created} ${res.created === 1 ? 'slot' : 'slots'}.${skippedNow}`);
        },
      },
    );

  if (preview) {
    return (
      <div>
        <p className="text-[15px] text-ink">{describeRule(preview.rule)}</p>
        <p className="mt-1 text-sm text-muted">
          {toCreate.length} new {toCreate.length === 1 ? 'slot' : 'slots'}
          {skipped > 0 && `, ${skipped} skipped`}. Check the times, then add them.
        </p>
        <PreviewList slots={preview.slots} tz={tz} />
        {bulk.error && (
          <div className="mt-4">
            <Notice tone="error">{errorMessage(bulk.error)}</Notice>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={save} loading={bulk.isPending} disabled={!toCreate.length}>
            Add {toCreate.length} {toCreate.length === 1 ? 'slot' : 'slots'}
          </Button>
          <Button variant="ghost" onClick={() => setPreview(null)}>
            Edit description
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={runPreview}>
      <label htmlFor="describe" className="sr-only">
        Describe when you are available
      </label>
      <textarea
        id="describe"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Every Tuesday and Thursday in November, 4–6pm"
        className={`${inputClass} resize-y`}
      />
      {parse.error && (
        <div className="mt-3">
          <Notice tone="error">{errorMessage(parse.error)}</Notice>
        </div>
      )}
      <Button type="submit" className="mt-3 w-full" loading={parse.isPending} disabled={text.trim().length < 3}>
        {parse.isPending ? 'Reading your schedule…' : 'Preview slots'}
      </Button>
    </form>
  );
}

const ISSUE_LABEL: Record<NonNullable<SlotPreviewItem['issue']>, string> = {
  past: 'Already passed, will be skipped',
  overlap: 'Overlaps an existing slot, will be skipped',
  calendar_busy: 'Clashes with a calendar event, hidden from clients until you free it',
};

function PreviewList({ slots, tz }: { slots: SlotPreviewItem[]; tz: string }) {
  const byDay = [...groupByDay(slots, tz).entries()];
  return (
    <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto border border-line p-3">
      {byDay.map(([day, items]) => (
        <li key={day} className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">{fmtDay(day, 'EEE, MMM d')}</span>
          <div className="flex flex-wrap gap-1.5">
            {items.map((s) => (
              <span
                key={s.startAt}
                title={s.issue ? ISSUE_LABEL[s.issue] : undefined}
                className={`rounded-md px-2 py-1 text-[13px] ${
                  s.issue === 'past' || s.issue === 'overlap'
                    ? 'bg-cell text-faint line-through'
                    : s.issue === 'calendar_busy'
                      ? 'border-l-2 border-warn bg-warn-soft text-[#9a4f12]'
                      : 'border-l-2 border-brand bg-brand-soft text-brand'
                }`}
              >
                {fmtTime(s.startAt, tz)}
                {s.issue && <span className="sr-only">: {ISSUE_LABEL[s.issue]}</span>}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

const DAY_NAMES: Record<string, string> = {
  MON: 'Mondays',
  TUE: 'Tuesdays',
  WED: 'Wednesdays',
  THU: 'Thursdays',
  FRI: 'Fridays',
  SAT: 'Saturdays',
  SUN: 'Sundays',
};

/** Shows how the AI read the description, so a misread is easy to spot before saving. */
function describeRule(r: AvailabilityRule) {
  const days = r.weekdays.map((d) => DAY_NAMES[d]);
  const dayText = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}` : days[0];
  const range = `${format(parseISO(r.dateFrom), 'MMM d')} to ${format(parseISO(r.dateTo), 'MMM d')}`;
  const time = (t: string) => format(parseISO(`2000-01-01T${t}`), 'h:mm a');
  return `${dayText}, ${range}, ${time(r.startTime)} – ${time(r.endTime)}, ${r.sessionMinutes}-minute sessions.`;
}

/* ---------- Manual: one slot ---------- */

function ManualMode({ tz, sessionMinutes, onDone }: { tz: string; sessionMinutes: number; onDone: (msg: string) => void }) {
  const create = useCreateSlot();
  const [date, setDate] = useState(todayKey(tz));
  const [time, setTime] = useState('16:00');
  const [duration, setDuration] = useState(sessionMinutes);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { date, startTime: time, durationMinutes: duration },
      { onSuccess: (s) => onDone(`Added ${fmtDay(dayKeyOf(s.startAt, tz), 'EEE, MMM d')} at ${fmtTime(s.startAt, tz)}.`) },
    );
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
        <Field label="Date" htmlFor="m-date">
          <input id="m-date" type="date" required min={todayKey(tz)} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        </div>
        <Field label="Start time" htmlFor="m-time">
          <input id="m-time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Duration" htmlFor="m-duration">
          <select id="m-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>
      {create.error && (
        <div className="mt-3">
          <Notice tone="error">{errorMessage(create.error)}</Notice>
        </div>
      )}
      <Button type="submit" className="mt-3 w-full" loading={create.isPending}>
        Add slot
      </Button>
    </form>
  );
}
