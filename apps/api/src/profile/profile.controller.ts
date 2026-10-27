import { Controller, Get, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Profile } from '@teamlift/shared';
import { SkipThrottle } from '@nestjs/throttler';
import { env } from '../config/env';
import { DB, Db } from '../db/db';
import { hostProfile } from '../db/schema';

@Controller()
export class ProfileController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('profile')
  async profile(): Promise<Profile> {
    const [row] = await this.db.select().from(hostProfile).where(eq(hostProfile.id, 1));
    return {
      name: row?.name ?? 'Instructor',
      title: row?.title ?? '',
      bio: row?.bio ?? '',
      sessionMinutes: row?.sessionMinutes ?? 30,
      location: row?.location ?? 'Online',
      timezone: env().APP_TIMEZONE,
    };
  }

  /** Render health check, and the web app's warm-up ping after a free-tier cold start. */
  @Get('health')
  @SkipThrottle()
  health() {
    return { status: 'ok' };
  }
}
