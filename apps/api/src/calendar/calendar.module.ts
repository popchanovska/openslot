import { Module } from '@nestjs/common';
import { AdminCalendarController, GoogleCallbackController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  controllers: [AdminCalendarController, GoogleCallbackController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
