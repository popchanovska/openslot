import { z } from 'zod';

const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const PlainTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour)');

/* ---------- Requests ---------- */

export const CreateBookingSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.email('Please enter a valid email').max(200),
});
export type CreateBookingInput = z.input<typeof CreateBookingSchema>;
export type CreateBooking = z.output<typeof CreateBookingSchema>;

/** Manual mode: one slot from the host's local date + time. */
export const CreateSlotSchema = z.object({
  date: PlainDate,
  startTime: PlainTime,
  durationMinutes: z.number().int().min(15).max(240),
});
export type CreateSlot = z.infer<typeof CreateSlotSchema>;

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

/**
 * Describe mode: the LLM turns free text into this rule, and the API expands it into
 * slots deterministically. The LLM never produces timestamps itself.
 */
export const AvailabilityRuleSchema = z
  .object({
    weekdays: z.array(WeekdaySchema).min(1).max(7),
    dateFrom: PlainDate,
    dateTo: PlainDate,
    startTime: PlainTime,
    endTime: PlainTime,
    sessionMinutes: z.number().int().min(15).max(240),
  })
  .refine((r) => r.dateTo >= r.dateFrom, { message: 'dateTo must be on or after dateFrom' })
  .refine((r) => r.endTime > r.startTime, { message: 'endTime must be after startTime' });
export type AvailabilityRule = z.infer<typeof AvailabilityRuleSchema>;

export const ParseAvailabilitySchema = z.object({
  text: z.string().trim().min(3, 'Describe when you are available').max(500),
});

export const BulkCreateSlotsSchema = z.object({
  slots: z
    .array(z.object({ startAt: z.iso.datetime(), endAt: z.iso.datetime() }))
    .min(1)
    .max(300),
});
export type BulkCreateSlots = z.infer<typeof BulkCreateSlotsSchema>;


/* ---------- Responses ---------- */

export interface Profile {
  name: string;
  title: string;
  bio: string;
  sessionMinutes: number;
  location: string;
  timezone: string;
}

export interface PublicSlot {
  id: string;
  startAt: string;
  endAt: string;
  status: 'available' | 'unavailable';
}

export interface PublicSlotsResponse {
  slots: PublicSlot[];
}

export interface BookingCreated {
  id: string;
  name: string;
  slot: { id: string; startAt: string; endAt: string };
}

export interface Confirmation {
  message: string;
  source: 'ai' | 'fallback';
}

export interface BookingDetails {
  id: string;
  name: string;
  email: string;
}

export interface InstructorSlot {
  id: string;
  startAt: string;
  endAt: string;
  booking: BookingDetails | null;
  /** Overlaps a busy block in the connected Google Calendar. */
  clash: boolean;
}

export interface BusyInterval {
  start: string;
  end: string;
}

/** An event from the instructor's Google Calendar. Only ever sent to the instructor view. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO instants for timed events; for all-day events, midnight UTC of the first day and the day after the last. */
  start: string;
  end: string;
  allDay: boolean;
  /** false for events marked "Free" in Google Calendar: shown, but they don't block slots. */
  busy: boolean;
  link: string | null;
}

export interface CalendarSync {
  configured: boolean;
  connected: boolean;
  error: string | null;
  /** Connected with permission to read event details (titles). Older connections only had free/busy. */
  showsEvents: boolean;
}

export interface InstructorCalendarResponse {
  slots: InstructorSlot[];
  busy: BusyInterval[];
  events: CalendarEvent[];
  google: CalendarSync;
}

export type PreviewIssue = 'past' | 'overlap' | 'calendar_busy';

export interface SlotPreviewItem {
  startAt: string;
  endAt: string;
  /** `past` and `overlap` are skipped on save; `calendar_busy` is only a warning. */
  issue: PreviewIssue | null;
}

export interface SlotPreviewResponse {
  rule: AvailabilityRule;
  slots: SlotPreviewItem[];
}

export interface BulkCreateResponse {
  created: number;
  skipped: { startAt: string; reason: 'past' | 'overlap' }[];
}

export type GoogleStatus = CalendarSync;
