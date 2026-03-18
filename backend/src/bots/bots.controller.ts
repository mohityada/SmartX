import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { CreateBotDto, UpdateBotDto } from './dto';
import { JwtAuthGuard, CurrentUser } from '../common';

@ApiTags('Bots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bot' })
  @ApiResponse({ status: 201, description: 'Bot created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBotDto) {
    return this.botsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all bots for the current user' })
  @ApiResponse({ status: 200, description: 'List of bots' })
  findAll(@CurrentUser('id') userId: string) {
    return this.botsService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bot by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bot details' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.botsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bot' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bot updated' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBotDto,
  ) {
    return this.botsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bot' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bot deleted' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.botsService.remove(id, userId);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start (activate) a bot' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bot started' })
  @ApiResponse({ status: 400, description: 'Bot is already active' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.botsService.start(id, userId);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop (deactivate) a bot' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bot stopped' })
  @ApiResponse({ status: 400, description: 'Bot is already stopped' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  stop(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.botsService.stop(id, userId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get activity log for a bot' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Activity log entries' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  getActivityLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;
    return this.botsService.getActivityLog(id, userId, parsedLimit);
  }
}
