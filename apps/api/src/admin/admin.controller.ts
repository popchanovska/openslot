import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  BulkCreateResponse,
  BulkCreateSlots,
  BulkCreateSlotsSchema,
  CreateSlot,
  CreateSlotSchema,
  InstructorCalendarResponse,
  ParseAvailabilitySchema,
  SlotPreviewResponse,
} from '@teamlift/shared';
import { AiService } from '../ai/ai.service';
import { ZodPipe } from '../common/zod.pipe';
import { env } from '../config/env';
import { SlotsService } from '../slots/slots.service';

const RangeQuery = z.object({ from: z.iso.datetime(), to: z.iso.datetime() });

/** The instructor's endpoints. Open by design: one host, no login (as the brief asks). */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly slots: SlotsService,
    private readonly ai: AiService,
  ) {}

  @Get('calendar')
  calendar(@Query(new ZodPipe(RangeQuery)) q: z.infer<typeof RangeQuery>): Promise<InstructorCalendarResponse> {
    return this.slots.listForInstructor(new Date(q.from), new Date(q.to));
  }

  @Post('slots')
  create(@Body(new ZodPipe(CreateSlotSchema)) body: CreateSlot) {
    return this.slots.createOne(body);
  }

  /** Describe mode: free text → AI rule → expanded preview. Saves nothing. */
  @Post('slots/parse')
  async parse(
    @Body(new ZodPipe(ParseAvailabilitySchema)) body: { text: string },
  ): Promise<SlotPreviewResponse> {
    const rule = await this.ai.parseAvailability(body.text, env().APP_TIMEZONE);
    return this.slots.preview(rule);
  }

  @Post('slots/bulk')
  bulk(@Body(new ZodPipe(BulkCreateSlotsSchema)) body: BulkCreateSlots): Promise<BulkCreateResponse> {
    return this.slots.bulkCreate(body);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.slots.remove(id);
  }
}
