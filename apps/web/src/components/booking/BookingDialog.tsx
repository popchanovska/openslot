import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookingCreated, CreateBooking, CreateBookingSchema, PublicSlot } from '@teamlift/shared';
import { useBook } from '../../api/hooks';
import { ApiError, errorMessage } from '../../api/client';
import { dayKeyOf, fmtDay, fmtRange, fmtTime } from '../../lib/time';
import { Button, Field, inputClass, Modal, Notice } from '../ui';

export function BookingDialog({
  slot,
  tz,
  onClose,
  onBooked,
}: {
  slot: PublicSlot | null;
  tz: string;
  onClose: () => void;
  onBooked: (booking: BookingCreated) => void;
}) {
  return (
    <Modal open={Boolean(slot)} onClose={onClose} label="Book a session">
      {slot && <BookingForm slot={slot} tz={tz} onClose={onClose} onBooked={onBooked} />}
    </Modal>
  );
}

/** The brief asks for name and email only. */
function BookingForm({
  slot,
  tz,
  onClose,
  onBooked,
}: {
  slot: PublicSlot;
  tz: string;
  onClose: () => void;
  onBooked: (booking: BookingCreated) => void;
}) {
  const book = useBook();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBooking>({ resolver: zodResolver(CreateBookingSchema), defaultValues: { name: '', email: '' } });
  const taken = book.error instanceof ApiError && book.error.status === 409;

  const submit = handleSubmit((input) => book.mutate({ slotId: slot.id, input }, { onSuccess: onBooked }));

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="text-xl font-medium text-ink">Book your session</h2>
      <p className="mt-1 text-[15px] text-muted">
        {fmtDay(dayKeyOf(slot.startAt, tz))} · {fmtRange(slot.startAt, slot.endAt, tz)}
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <input id="name" autoComplete="name" autoFocus className={inputClass} aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} aria-invalid={!!errors.email} {...register('email')} />
        </Field>
      </div>

      {book.error && (
        <div className="mt-5">
          <Notice tone="error">{errorMessage(book.error)}</Notice>
        </div>
      )}

      <div className="mt-7 flex gap-2">
        <Button type="button" variant="ghost" className="flex-1 border border-line" onClick={onClose}>
          {taken ? 'Pick another time' : 'Cancel'}
        </Button>
        {!taken && (
          <Button type="submit" className="flex-1" loading={book.isPending}>
            Book {fmtTime(slot.startAt, tz)}
          </Button>
        )}
      </div>
    </form>
  );
}
