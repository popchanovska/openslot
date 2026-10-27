import { Controller, Get } from '@nestjs/common';
import type { PublicSlotsResponse } from '@teamlift/shared';
import { SlotsService } from './slots.service';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  async list(): Promise<PublicSlotsResponse> {
    return { slots: await this.slots.listPublic() };
  }
}
