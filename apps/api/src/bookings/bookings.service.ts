import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { BookingCreated, Confirmation, CreateBooking } from '@teamlift/shared';
import { AiService } from '../ai/ai.service';
import { CalendarService } from '../calendar/calendar.service';
import { humanDateTime } from '../common/time';
import { env } from '../config/env';
import { DB, Db, PG, pgErrorCode } from '../db/db';
import { bookings, slots } from '../db/schema';
import { clashesWith } from '../slots/slots.service';

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly calendar: CalendarService,
    private readonly ai: AiService,
  ) {}

  async create(slotId: string, input: CreateBooking, now = new Date()): Promise<BookingCreated> {
    const [slot] = await this.db.select().from(slots).where(eq(slots.id, slotId));
    if (!slot) throw new NotFoundException('This slot no longer exists');
    if (slot.startAt <= now) throw new ConflictException('This slot has already started. Please pick another time.');

    // The list may be up to a minute old: re-check the calendar for this one slot, uncached.
    const { busy } = await this.calendar.busy(slot.startAt, slot.endAt, { fresh: true });
    if (clashesWith(slot, busy)) throw new ConflictException('This time is no longer available. Please pick another.');

    try {
      const [row] = await this.db
        .insert(bookings)
        .values({
          slotId,
          guestName: input.name,
          guestEmail: input.email.toLowerCase(),
        })
        .returning();
      return {
        id: row.id,
        name: row.guestName,
        slot: { id: slot.id, startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() },
      };
    } catch (err) {
      // The database decides races: UNIQUE(slot_id) lets exactly one concurrent booking through.
      const code = pgErrorCode(err);
      if (code === PG.UNIQUE_VIOLATION) {
        throw new ConflictException('Someone just booked this slot. Please pick another time.');
      }
      if (code === PG.FOREIGN_KEY_VIOLATION) throw new NotFoundException('This slot no longer exists');
      throw err;
    }
  }

  /**
   * Called by the web app right after a successful booking, so a slow or failing LLM
   * never blocks the booking itself. AI output is cached; template fallbacks are not,
   * so a later reload can still get the personal version.
   */
  async confirmation(bookingId: string): Promise<Confirmation> {
    const [row] = await this.db
      .select({ booking: bookings, slot: slots })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .where(eq(bookings.id, bookingId));
    if (!row) throw new NotFoundException('Booking not found');

    const { booking, slot } = row;
    if (booking.confirmationMessage) return { message: booking.confirmationMessage, source: 'ai' };

    const result = await this.ai.confirmation({
      // Only the first name and the time go to the LLM. Never the email.
      firstName: booking.guestName.trim().split(/\s+/)[0],
      when: humanDateTime(slot.startAt, env().APP_TIMEZONE),
      minutes: Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60_000),
    });
    if (result.source === 'ai') {
      await this.db
        .update(bookings)
        .set({ confirmationMessage: result.message })
        .where(eq(bookings.id, bookingId));
    }
    return result;
  }
}
