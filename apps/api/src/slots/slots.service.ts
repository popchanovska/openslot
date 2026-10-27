import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';
import type {
  AvailabilityRule,
  BulkCreateResponse,
  BulkCreateSlots,
  BusyInterval,
  CreateSlot,
  InstructorCalendarResponse,
  PublicSlot,
  SlotPreviewResponse,
} from '@teamlift/shared';
import { expandRule, localToUtc, overlaps } from '../common/time';
import { env } from '../config/env';
import { CalendarService } from '../calendar/calendar.service';
import { DB, Db, PG, pgErrorCode } from '../db/db';
import { bookings, slots } from '../db/schema';

/** Clients see this far ahead. Also bounds the free/busy query. */
export const PUBLIC_HORIZON_DAYS = 90;
const DAY_MS = 86_400_000;

export function clashesWith(slot: { startAt: Date; endAt: Date }, busy: BusyInterval[]) {
  return busy.some((b) =>
    overlaps({ start: slot.startAt, end: slot.endAt }, { start: new Date(b.start), end: new Date(b.end) }),
  );
}

@Injectable()
export class SlotsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * What clients see: upcoming slots, booked ones as "unavailable" (so a taken slot
   * visibly stays taken), and open slots that clash with the host's calendar left out.
   */
  async listPublic(now = new Date()): Promise<PublicSlot[]> {
    const rows = await this.db
      .select({ id: slots.id, startAt: slots.startAt, endAt: slots.endAt, bookingId: bookings.id })
      .from(slots)
      .leftJoin(bookings, eq(bookings.slotId, slots.id))
      .where(and(gt(slots.startAt, now), lt(slots.startAt, new Date(now.getTime() + PUBLIC_HORIZON_DAYS * DAY_MS))))
      .orderBy(asc(slots.startAt));
    if (!rows.length) return [];

    const { busy } = await this.calendar.busy(now, rows[rows.length - 1].endAt);
    return rows
      .filter((r) => r.bookingId || !clashesWith(r, busy))
      .map((r) => ({
        id: r.id,
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
        status: r.bookingId ? 'unavailable' : 'available',
      }));
  }

  /** The instructor's month view: every slot with its booking, plus busy blocks and clash flags. */
  async listForInstructor(from: Date, to: Date): Promise<InstructorCalendarResponse> {
    if (to <= from || to.getTime() - from.getTime() > 62 * DAY_MS) {
      throw new BadRequestException('Range must be positive and at most 62 days');
    }
    const rows = await this.db
      .select({ slot: slots, booking: bookings })
      .from(slots)
      .leftJoin(bookings, eq(bookings.slotId, slots.id))
      .where(and(gte(slots.startAt, from), lt(slots.startAt, to)))
      .orderBy(asc(slots.startAt));

    const [{ busy, sync }, events] = await Promise.all([this.calendar.busy(from, to), this.calendar.events(from, to)]);
    return {
      google: sync,
      busy,
      events,
      slots: rows.map(({ slot, booking }) => ({
        id: slot.id,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        clash: clashesWith(slot, busy),
        booking: booking
          ? {
              id: booking.id,
              name: booking.guestName,
              email: booking.guestEmail,
            }
          : null,
      })),
    };
  }

  /** Manual mode: one slot from the host's local date and time. */
  async createOne(input: CreateSlot, now = new Date()) {
    const startAt = localToUtc(input.date, input.startTime, env().APP_TIMEZONE);
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
    if (startAt <= now) throw new BadRequestException('That time is in the past');
    try {
      const [row] = await this.db.insert(slots).values({ startAt, endAt }).returning();
      return { id: row.id, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString() };
    } catch (err) {
      if (pgErrorCode(err) === PG.EXCLUSION_VIOLATION) {
        throw new ConflictException('This overlaps a slot you already have');
      }
      throw err;
    }
  }

  /** Describe mode, step 2: expand the rule and flag problems. Nothing is saved. */
  async preview(rule: AvailabilityRule, now = new Date()): Promise<SlotPreviewResponse> {
    let expanded: { startAt: Date; endAt: Date }[];
    try {
      expanded = expandRule(rule, env().APP_TIMEZONE);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (!expanded.length) return { rule, slots: [] };

    const from = expanded[0].startAt;
    const to = expanded[expanded.length - 1].endAt;
    const existing = await this.db
      .select({ startAt: slots.startAt, endAt: slots.endAt })
      .from(slots)
      .where(and(lt(slots.startAt, to), gt(slots.endAt, from)));
    const { busy } = await this.calendar.busy(from, to);

    return {
      rule,
      slots: expanded.map((s) => {
        const issue =
          s.startAt <= now
            ? 'past'
            : existing.some((e) => overlaps({ start: s.startAt, end: s.endAt }, { start: e.startAt, end: e.endAt }))
              ? 'overlap'
              : clashesWith(s, busy)
                ? 'calendar_busy'
                : null;
        return { startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString(), issue };
      }),
    };
  }

  /** Describe mode, step 3: save the confirmed preview. Overlaps are skipped, not errors. */
  async bulkCreate(input: BulkCreateSlots, now = new Date()): Promise<BulkCreateResponse> {
    const skipped: BulkCreateResponse['skipped'] = [];
    const values: { startAt: Date; endAt: Date }[] = [];
    for (const s of input.slots) {
      const startAt = new Date(s.startAt);
      const endAt = new Date(s.endAt);
      if (endAt <= startAt || endAt.getTime() - startAt.getTime() > 240 * 60_000) {
        throw new BadRequestException('Each slot must be between 1 and 240 minutes long');
      }
      if (startAt <= now) skipped.push({ startAt: s.startAt, reason: 'past' });
      else values.push({ startAt, endAt });
    }
    if (!values.length) return { created: 0, skipped };

    // With no conflict target, ON CONFLICT DO NOTHING also covers the exclusion constraint,
    // so any slot that overlaps an existing one (or an earlier one in this batch) is skipped.
    const inserted = await this.db
      .insert(slots)
      .values(values)
      .onConflictDoNothing()
      .returning({ startAt: slots.startAt });
    const created = new Set(inserted.map((r) => r.startAt.getTime()));
    for (const v of values) {
      if (!created.has(v.startAt.getTime())) skipped.push({ startAt: v.startAt.toISOString(), reason: 'overlap' });
    }
    return { created: inserted.length, skipped };
  }

  async remove(id: string) {
    const [booked] = await this.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.slotId, id));
    if (booked) throw new ConflictException('This slot is booked. Contact the client before removing it.');
    try {
      const deleted = await this.db.delete(slots).where(eq(slots.id, id)).returning({ id: slots.id });
      if (!deleted.length) throw new NotFoundException('Slot not found');
    } catch (err) {
      // A booking landed between the check and the delete.
      if (pgErrorCode(err) === PG.FOREIGN_KEY_VIOLATION) throw new ConflictException('This slot was just booked');
      throw err;
    }
  }
}
