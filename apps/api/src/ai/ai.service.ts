import { Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { AvailabilityRule, AvailabilityRuleSchema, WEEKDAYS } from '@teamlift/shared';
import { todayInZone } from '../common/time';
import { GeminiClient } from './gemini.client';

const ConfirmationOutput = z.object({ message: z.string().trim().min(10).max(400) });

export interface ConfirmationInput {
  firstName: string;
  /** Already formatted in the host's zone, e.g. "Monday 26 October at 6:30 PM". */
  when: string;
  minutes: number;
}

/** Used when there's no Gemini key, the call times out, or the output fails validation. */
export const fallbackMessage = (firstName: string, when: string) =>
  `You're booked for ${when}, ${firstName}. See you then!`;

@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);
  /** Booking UX shouldn't wait on the LLM for long; the template is good enough. */
  static CONFIRMATION_TIMEOUT_MS = 6000;

  constructor(private readonly gemini: GeminiClient) {}

  /** A short, friendly confirmation. Never throws: any failure returns the template message. */
  async confirmation(input: ConfirmationInput): Promise<{ message: string; source: 'ai' | 'fallback' }> {
    const fallback = { message: fallbackMessage(input.firstName, input.when), source: 'fallback' as const };
    if (!this.gemini.isConfigured()) return fallback;

    try {
      const raw = await this.gemini.generateJson({
        timeoutMs: AiService.CONFIRMATION_TIMEOUT_MS,
        system: [
          'You write a short, friendly booking confirmation for a 1:1 session.',
          'Return JSON with "message": 1–2 warm, plain sentences, at most 35 words.',
          'Address the person by first name and state the day and time exactly as given.',
          'No emojis, no links, no promises about outcomes.',
        ].join(' '),
        prompt: `First name: ${input.firstName}\nSession: ${input.when} (${input.minutes} minutes, online)`,
        schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      });
      return { ...ConfirmationOutput.parse(raw), source: 'ai' };
    } catch (err) {
      this.log.warn(`Confirmation fell back to template: ${(err as Error).message}`);
      return fallback;
    }
  }

  /**
   * "Every Tuesday and Thursday in November, 4–6pm" → an AvailabilityRule.
   * The LLM only extracts intent; the API expands the rule into slots itself.
   */
  async parseAvailability(text: string, tz: string): Promise<AvailabilityRule> {
    if (!this.gemini.isConfigured()) {
      throw new ServiceUnavailableException('AI is not configured on the server. Use Manual mode instead.');
    }
    const today = todayInZone(tz);
    let raw: unknown;
    try {
      raw = await this.gemini.generateJson({
        timeoutMs: 12000,
        temperature: 0,
        system: [
          'Convert an instructor\'s description of their availability into a recurring rule.',
          `Today is ${today.weekday} ${today.date}. Times are local (${tz}), 24-hour HH:mm.`,
          'Resolve relative dates ("next week", "November") to concrete YYYY-MM-DD dates, never in the past.',
          'A month name means the whole month. "Weekdays" means MON–FRI.',
          'If no session length is given, use 30 minutes. If no date range is given, use the next 4 weeks.',
        ].join(' '),
        prompt: text,
        schema: {
          type: 'object',
          properties: {
            weekdays: { type: 'array', items: { type: 'string', enum: [...WEEKDAYS] } },
            dateFrom: { type: 'string', description: 'YYYY-MM-DD' },
            dateTo: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
            startTime: { type: 'string', description: 'HH:mm' },
            endTime: { type: 'string', description: 'HH:mm, end of the availability window' },
            sessionMinutes: { type: 'integer' },
          },
          required: ['weekdays', 'dateFrom', 'dateTo', 'startTime', 'endTime', 'sessionMinutes'],
        },
      });
    } catch (err) {
      this.log.warn(`Availability parsing failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('The AI could not be reached. Try again, or use Manual mode.');
    }
    const parsed = AvailabilityRuleSchema.safeParse(raw);
    if (!parsed.success) {
      throw new UnprocessableEntityException(
        "Couldn't turn that into a schedule. Try something like “Weekdays next week, 10:00–12:00, 30-minute sessions”.",
      );
    }
    return parsed.data;
  }
}
