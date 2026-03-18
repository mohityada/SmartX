import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../common';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List ingested events' })
  @ApiQuery({ name: 'category', required: false, example: 'trending' })
  @ApiQuery({ name: 'source', required: false, example: 'crypto' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, description: 'Paginated list of events' })
  findAll(
    @Query('category') category?: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.eventsService.findAll({
      category,
      source,
      limit: limit ? parseInt(limit, 10) || 50 : 50,
      offset: offset ? parseInt(offset, 10) || 0 : 0,
    });
  }

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger an immediate ingestion cycle (enqueues jobs)' })
  @ApiResponse({ status: 202, description: 'Ingestion jobs enqueued' })
  async triggerIngestion() {
    await this.eventsService.scheduleIngestion();
    return { message: 'Ingestion jobs enqueued' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get event queue health metrics' })
  @ApiResponse({ status: 200, description: 'Queue health metrics' })
  getQueueHealth() {
    return this.eventsService.getQueueHealth();
  }
}
