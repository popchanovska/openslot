import type { BookingCreated } from '@teamlift/shared';
import { useConfirmation } from '../../api/hooks';
import { dayKeyOf, fmtDay, fmtRange } from '../../lib/time';
import { Button, Modal } from '../ui';

export function SuccessModal({ booking, tz, onClose }: { booking: BookingCreated | null; tz: string; onClose: () => void }) {
  return (
    <Modal open={Boolean(booking)} onClose={onClose} label="You're booked" className="text-center">
      {booking && <Success booking={booking} tz={tz} onClose={onClose} />}
    </Modal>
  );
}

function Success({ booking, tz, onClose }: { booking: BookingCreated; tz: string; onClose: () => void }) {
  const confirmation = useConfirmation(booking.id);

  return (
    <>
      <div className="mx-auto grid size-12 place-items-center bg-ok-soft text-ok" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="mt-4 text-[22px] font-medium text-ink">You're booked!</h2>
      <p className="mt-1 text-[15px] text-muted">
        {fmtDay(dayKeyOf(booking.slot.startAt, tz))} · {fmtRange(booking.slot.startAt, booking.slot.endAt, tz)}
      </p>

      {/* The AI-written confirmation; a template while it loads or if the AI is unavailable. */}
      <div className="mt-5 min-h-12" aria-live="polite">
        {confirmation.isPending ? (
          <div className="mx-auto max-w-xs space-y-2" aria-label="Writing your confirmation">
            <div className="h-3.5 animate-pulse bg-cell" />
            <div className="mx-auto h-3.5 w-2/3 animate-pulse bg-cell" />
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-ink">
            {confirmation.data?.message ?? `You're booked, ${booking.name.split(' ')[0]}. See you then!`}
          </p>
        )}
      </div>

      <Button className="mt-7 w-full" onClick={onClose}>
        Done
      </Button>
    </>
  );
}
