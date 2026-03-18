import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard, CurrentUser } from '../common';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('bots/:id/summary')
  getBotSummary(
    @Param('id', ParseUUIDPipe) botId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getBotSummary(botId, userId);
  }

  @Get('bots/:id/activity')
  getRecentActivity(@Param('id', ParseUUIDPipe) botId: string) {
    return this.analyticsService.getRecentActivity(botId);
  }
}
