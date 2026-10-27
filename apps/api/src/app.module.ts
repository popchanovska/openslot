import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { AiModule } from './ai/ai.module';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { CalendarModule } from './calendar/calendar.module';
import { DbModule } from './db/db.module';
import { ProfileController } from './profile/profile.controller';
import { SlotsController } from './slots/slots.controller';
import { SlotsService } from './slots/slots.service';

@Module({
  imports: [
    DbModule,
    CalendarModule,
    AiModule,
    // Per-IP rate limit; booking and AI routes set tighter limits of their own.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [ProfileController, SlotsController, BookingsController, AdminController],
  providers: [SlotsService, BookingsService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
