import { ButtonHTMLAttributes, forwardRef, ReactNode, useEffect, useRef, useState } from 'react';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50',
  soft: 'bg-brand-soft text-brand hover:bg-[#dde1f7] disabled:opacity-50',
  ghost: 'text-muted hover:text-ink hover:bg-cell disabled:opacity-50',
  danger: 'bg-danger-soft text-danger hover:bg-[#f6dcda] disabled:opacity-50',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm'; loading?: boolean }
>(({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${
      size === 'md' ? 'h-11 px-4 text-[15px]' : 'h-8 px-3 text-[13px]'
    } ${VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {loading && <Spinner />}
    {children}
  </button>
));
Button.displayName = 'Button';

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Modal({
  open,
  onClose,
  children,
  label,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-32px)] max-w-[440px] border border-line bg-surface p-0 text-ink shadow-[0_24px_48px_-20px_rgba(28,31,43,0.35)] ${className}`}
    >
      {open && <div className="p-6 sm:p-8">{children}</div>}
    </dialog>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function Notice({ tone, children, onDismiss }: { tone: 'ok' | 'warn' | 'error'; children: ReactNode; onDismiss?: () => void }) {
  const styles = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-[#9a4f12]', error: 'bg-danger-soft text-danger' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${styles}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="-my-1  px-1 text-lg leading-none opacity-70 hover:opacity-100" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

/** True once `active` has stayed true for `ms`. Used for the free-hosting cold-start notice. */
export function useSlowFlag(active: boolean, ms = 2500) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return slow;
}

/** Only on the hosted build: locally a slow first load means the API isn't running, not sleeping. */
export function WakingNotice({ show }: { show: boolean }) {
  if (!show || !import.meta.env.PROD) return null;
  return (
    <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 text-sm text-muted sm:px-8">
      <Spinner className="size-4 text-brand" />
      Waking up the server. The free hosting plan sleeps when idle, so the first load can take up to a minute.
    </div>
  );
}

export const inputClass =
  'w-full border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand aria-[invalid=true]:border-danger';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
