import { Controller, Delete, Get, HttpCode, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { GoogleStatus } from '@teamlift/shared';
import { env } from '../config/env';
import { CalendarService } from './calendar.service';

@Controller('admin/google')
export class AdminCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('status')
  status(): Promise<GoogleStatus> {
    return this.calendar.status();
  }

  /** Returns Google's consent URL; the web app then sends the browser there. */
  @Get('connect')
  connect(): { url: string } {
    return { url: this.calendar.authUrl() };
  }

  @Delete()
  @HttpCode(204)
  async disconnect() {
    await this.calendar.disconnect();
  }
}

/** Google redirects the browser here. The signed `state` proves this server started the flow. */
@Controller('google')
export class GoogleCallbackController {
  private readonly log = new Logger(GoogleCallbackController.name);

  constructor(private readonly calendar: CalendarService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const back = new URL('/instructor', env().FRONTEND_URL);
    try {
      if (error) throw new Error(error === 'access_denied' ? 'Access was not granted' : error);
      await this.calendar.handleCallback(code, state);
      back.searchParams.set('google', 'connected');
    } catch (err) {
      this.log.warn(`Google connect failed: ${(err as Error).message}`);
      back.searchParams.set('google', 'error');
      back.searchParams.set('reason', (err as Error).message);
    }
    res.redirect(back.toString());
  }
}
