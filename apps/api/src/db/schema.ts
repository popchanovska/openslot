import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Single row: the one host who publishes slots. */
export const hostProfile = pgTable(
  'host_profile',
  {
    id: smallint('id').primaryKey().default(1),
    name: text('name').notNull(),
    title: text('title').notNull(),
    bio: text('bio').notNull(),
    sessionMinutes: integer('session_minutes').notNull().default(30),
    location: text('location').notNull(),
  },
  (t) => [check('host_profile_single_row', sql`${t.id} = 1`)],
);

/**
 * Availability is derived: a slot is booked when a booking row exists.
 * Overlapping slots are blocked by an exclusion constraint added in a raw SQL migration.
 */
export const slots = pgTable(
  'slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    startAt: tz('start_at').notNull(),
    endAt: tz('end_at').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('slots_end_after_start', sql`${t.endAt} > ${t.startAt}`),
    index('slots_start_at_idx').on(t.startAt),
  ],
);

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // UNIQUE is the double-booking guarantee: of two concurrent inserts, exactly one wins.
  slotId: uuid('slot_id')
    .notNull()
    .unique('bookings_slot_id_unique')
    .references(() => slots.id, { onDelete: 'restrict' }),
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email').notNull(),
  confirmationMessage: text('confirmation_message'),
  createdAt: tz('created_at').notNull().defaultNow(),
});

/** Zero or one row. Only the refresh token is stored, encrypted; access tokens live in memory. */
export const googleConnection = pgTable(
  'google_connection',
  {
    id: smallint('id').primaryKey().default(1),
    calendarId: text('calendar_id').notNull().default('primary'),
    scope: text('scope').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    connectedAt: tz('connected_at').notNull().defaultNow(),
    lastError: text('last_error'),
  },
  (t) => [check('google_connection_single_row', sql`${t.id} = 1`)],
);

export type SlotRow = typeof slots.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
