import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingCreated, Confirmation, CreateBooking, CreateBookingSchema } from '@teamlift/shared';
import { ZodPipe } from '../common/zod.pipe';
import { BookingsService } from './bookings.service';

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('slots/:id/bookings')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @Param('id', new ParseUUIDPipe()) slotId: string,
    @Body(new ZodPipe(CreateBookingSchema)) body: CreateBooking,
  ): Promise<BookingCreated> {
    return this.bookings.create(slotId, body);
  }

  @Post('bookings/:id/confirmation')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirmation(@Param('id', new ParseUUIDPipe()) id: string): Promise<Confirmation> {
    return this.bookings.confirmation(id);
  }
}
