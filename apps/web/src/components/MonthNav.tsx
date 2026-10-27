import { fmtMonth, Month, shiftMonth } from '../lib/time';

export function MonthNav({ month, onChange, canGoBack = true }: { month: Month; onChange: (m: Month) => void; canGoBack?: boolean }) {
  const btn =
    'grid size-8 place-items-center rounded-lg border border-line bg-surface text-brand transition-colors hover:bg-brand-tint disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface';
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        className={btn}
        disabled={!canGoBack}
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label={`Previous month, ${fmtMonth(shiftMonth(month, -1))}`}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label={`Next month, ${fmtMonth(shiftMonth(month, 1))}`}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
