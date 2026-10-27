import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import type { BusyInterval, CalendarEvent, CalendarSync } from '@teamlift/shared';
import { env } from '../config/env';
import { DB, Db } from '../db/db';
import { googleConnection } from '../db/schema';
import { decrypt, encrypt, signState, verifyState } from './token-crypto';

/** Free/busy drives clash detection (what clients can book). */
export const FREEBUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';
/** Read-only events: titles and times shown on the instructor's own calendar view. */
export const EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const CACHE_MS = 60_000;

const NOT_CONFIGURED: CalendarSync = { configured: false, connected: false, error: null, showsEvents: false };
const NOT_CONNECTED: CalendarSync = { configured: true, connected: false, error: null, showsEvents: false };

export interface BusyResult {
  busy: BusyInterval[];
  sync: CalendarSync;
}

/**
 * Google Calendar clash detection. Everything here fails open: if Google is
 * unreachable, slots stay visible and the instructor sees a "reconnect" state.
 */
@Injectable()
export class CalendarService {
  private readonly log = new Logger(CalendarService.name);
  private cache = new Map<string, { at: number; busy: BusyInterval[] }>();
  private eventCache = new Map<string, { at: number; events: CalendarEvent[] }>();
  private client: OAuth2Client | null = null;
  private clientTokenEnc: string | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  isConfigured() {
    const e = env();
    return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REDIRECT_URI && e.TOKEN_ENCRYPTION_KEY);
  }

  private newClient() {
    const e = env();
    return new OAuth2Client({
      clientId: e.GOOGLE_CLIENT_ID,
      clientSecret: e.GOOGLE_CLIENT_SECRET,
      redirectUri: e.GOOGLE_REDIRECT_URI,
    });
  }

  private async connection() {
    const [row] = await this.db.select().from(googleConnection).where(eq(googleConnection.id, 1));
    return row ?? null;
  }

  async status(): Promise<CalendarSync> {
    if (!this.isConfigured()) return NOT_CONFIGURED;
    const row = await this.connection();
    return row ? this.syncOf(row, row.lastError) : NOT_CONNECTED;
  }

  private syncOf(row: { scope: string }, error: string | null): CalendarSync {
    return { configured: true, connected: true, error, showsEvents: row.scope.includes(EVENTS_SCOPE) };
  }

  /* ---------- OAuth ---------- */

  authUrl(): string {
    if (!this.isConfigured()) throw new BadRequestException('Google Calendar is not configured on the server');
    return this.newClient().generateAuthUrl({
      access_type: 'offline', // we need a refresh token, not just a one-hour access token
      prompt: 'consent', // makes Google return a refresh token even on reconnect
      scope: [FREEBUSY_SCOPE, EVENTS_SCOPE],
      state: signState(env().TOKEN_ENCRYPTION_KEY!),
    });
  }

  async handleCallback(code: string | undefined, state: string | undefined) {
    if (!this.isConfigured()) throw new Error('Google Calendar is not configured');
    if (!state || !verifyState(state, env().TOKEN_ENCRYPTION_KEY!)) throw new Error('Invalid or expired state');
    if (!code) throw new Error('Missing authorization code');

    const { tokens } = await this.newClient().getToken(code);
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
    if (!tokens.scope?.includes(FREEBUSY_SCOPE)) throw new Error('Free/busy permission was not granted');

    const values = {
      id: 1,
      calendarId: 'primary',
      scope: tokens.scope,
      refreshTokenEnc: encrypt(tokens.refresh_token, env().TOKEN_ENCRYPTION_KEY!),
      connectedAt: new Date(),
      lastError: null,
    };
    // Always overwrite the single row; Google invalidates old refresh tokens past a per-account limit anyway.
    await this.db.insert(googleConnection).values(values).onConflictDoUpdate({ target: googleConnection.id, set: values });
    this.resetClient();
  }

  async disconnect() {
    const row = await this.connection();
    if (!row) return;
    try {
      await this.newClient().revokeToken(decrypt(row.refreshTokenEnc, env().TOKEN_ENCRYPTION_KEY!));
    } catch (err) {
      // Already revoked or expired: still remove it locally.
      this.log.warn(`Token revoke failed: ${(err as Error).message}`);
    }
    await this.db.delete(googleConnection).where(eq(googleConnection.id, 1));
    this.resetClient();
  }

  private resetClient() {
    this.client = null;
    this.clientTokenEnc = null;
    this.cache.clear();
    this.eventCache.clear();
  }

  /* ---------- Free/busy ---------- */

  /**
   * Busy intervals in [from, to). Cached for 60s; pass `fresh` for the re-check
   * right before a booking is written.
   */
  async busy(from: Date, to: Date, opts: { fresh?: boolean } = {}): Promise<BusyResult> {
    if (!this.isConfigured()) return { busy: [], sync: NOT_CONFIGURED };
    const row = await this.connection();
    if (!row) return { busy: [], sync: NOT_CONNECTED };

    // Round the window to 5 minutes so "from now" queries share a cache entry.
    const step = 5 * 60_000;
    from = new Date(Math.floor(from.getTime() / step) * step);
    to = new Date(Math.ceil(to.getTime() / step) * step);
    const key = `${from.toISOString()}|${to.toISOString()}`;
    const hit = this.cache.get(key);
    if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) {
      return { busy: hit.busy, sync: this.syncOf(row, row.lastError) };
    }

    try {
      const busy = await this.queryFreeBusy(row.refreshTokenEnc, row.calendarId, from, to);
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(key, { at: Date.now(), busy });
      if (row.lastError) await this.setError(null);
      return { busy, sync: this.syncOf(row, null) };
    } catch (err) {
      const message = this.describeError(err);
      this.log.warn(`Free/busy failed, showing slots without clash detection: ${message}`);
      await this.setError(message);
      return { busy: [], sync: this.syncOf(row, message) };
    }
  }

  /**
   * The instructor's own events in [from, to), for the dashboard calendar. Never sent to
   * clients. Empty when not connected, when the connection predates the events permission,
   * or when Google fails (the free/busy call reports errors; this one just stays quiet).
   */
  async events(from: Date, to: Date): Promise<CalendarEvent[]> {
    if (!this.isConfigured()) return [];
    const row = await this.connection();
    if (!row || !row.scope.includes(EVENTS_SCOPE)) return [];

    const key = `${from.toISOString()}|${to.toISOString()}`;
    const hit = this.eventCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.events;

    try {
      const client = this.authorized(row.refreshTokenEnc);
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true', // expand recurring events into their occurrences
        orderBy: 'startTime',
        maxResults: '250',
        fields: 'items(id,summary,start,end,transparency,status,htmlLink)',
      });
      const res = await client.request<{ items?: GoogleEvent[] }>({
        url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(row.calendarId)}/events?${params}`,
        timeout: 8000,
      });
      const events = (res.data.items ?? []).filter((e) => e.status !== 'cancelled').map(toCalendarEvent);
      if (this.eventCache.size > 100) this.eventCache.clear();
      this.eventCache.set(key, { at: Date.now(), events });
      return events;
    } catch (err) {
      this.log.warn(`Listing events failed: ${this.describeError(err)}`);
      return [];
    }
  }

  /** One OAuth client per stored token; it refreshes the one-hour access token by itself. */
  private authorized(tokenEnc: string) {
    if (!this.client || this.clientTokenEnc !== tokenEnc) {
      this.client = this.newClient();
      this.client.setCredentials({ refresh_token: decrypt(tokenEnc, env().TOKEN_ENCRYPTION_KEY!) });
      this.clientTokenEnc = tokenEnc;
    }
    return this.client;
  }

  private async queryFreeBusy(tokenEnc: string, calendarId: string, from: Date, to: Date): Promise<BusyInterval[]> {
    const res = await this.authorized(tokenEnc).request<{
      calendars: Record<string, { busy?: BusyInterval[]; errors?: { reason: string }[] }>;
    }>({
      url: 'https://www.googleapis.com/calendar/v3/freeBusy',
      method: 'POST',
      data: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] },
      timeout: 8000,
    });
    const cal = res.data.calendars?.[calendarId];
    if (cal?.errors?.length) throw new Error(`Calendar error: ${cal.errors[0].reason}`);
    return (cal?.busy ?? []).map((b) => ({
      start: new Date(b.start).toISOString(),
      end: new Date(b.end).toISOString(),
    }));
  }

  private describeError(err: unknown): string {
    const e = err as { message?: string; response?: { data?: { error?: string } } };
    const reason = e.response?.data?.error ?? e.message ?? 'unknown error';
    if (String(reason).includes('invalid_grant')) {
      return 'Google access expired or was revoked. Reconnect to keep clash detection on.';
    }
    return `Could not reach Google Calendar (${reason}).`;
  }

  private async setError(message: string | null) {
    await this.db.update(googleConnection).set({ lastError: message }).where(eq(googleConnection.id, 1));
  }
}

interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  transparency?: 'opaque' | 'transparent';
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

function toCalendarEvent(e: GoogleEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary?.trim() || '(No title)',
    start: allDay ? `${e.start.date}T00:00:00.000Z` : new Date(e.start.dateTime!).toISOString(),
    end: allDay ? `${e.end.date}T00:00:00.000Z` : new Date(e.end.dateTime!).toISOString(),
    allDay,
    busy: e.transparency !== 'transparent',
    link: e.htmlLink ?? null,
  };
}
