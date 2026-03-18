import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QueueHealthService } from './queue-health.service';
import { SchedulerService } from './scheduler.service';
import { QUEUES } from './queue.constants';

@ApiTags('admin/queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/queues')
export class QueueAdminController {
  constructor(
    private readonly queueHealth: QueueHealthService,
    private readonly scheduler: SchedulerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get stats for all queues' })
  async getAllStats() {
    return this.queueHealth.getAllQueueStats();
  }

  @Get(':queueName')
  @ApiOperation({ summary: 'Get stats for a specific queue' })
  async getStats(@Param('queueName') queueName: string) {
    this.validateQueueName(queueName);
    const stats = await this.queueHealth.getQueueStats(queueName);
    if (!stats) throw new NotFoundException(`Queue ${queueName} not found`);
    return stats;
  }

  @Post(':queueName/clean-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean all failed jobs from a queue' })
  async cleanFailed(@Param('queueName') queueName: string) {
    this.validateQueueName(queueName);
    const count = await this.queueHealth.cleanFailedJobs(queueName);
    return { cleaned: count };
  }

  @Post(':queueName/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs in a queue' })
  async retryFailed(@Param('queueName') queueName: string) {
    this.validateQueueName(queueName);
    const count = await this.queueHealth.retryFailedJobs(queueName);
    return { retried: count };
  }

  @Post(':queueName/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a queue' })
  async pause(@Param('queueName') queueName: string) {
    this.validateQueueName(queueName);
    await this.queueHealth.pauseQueue(queueName);
    return { paused: true };
  }

  @Post(':queueName/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused queue' })
  async resume(@Param('queueName') queueName: string) {
    this.validateQueueName(queueName);
    await this.queueHealth.resumeQueue(queueName);
    return { resumed: true };
  }

  @Post('scheduler/run-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Immediately run auto-scheduler for all active bots',
  })
  async runSchedulerNow() {
    await this.scheduler.autoScheduleAll();
    return { triggered: true };
  }

  private validateQueueName(name: string) {
    const validNames = Object.values(QUEUES) as string[];
    if (!validNames.includes(name)) {
      throw new NotFoundException(
        `Unknown queue: ${name}. Valid queues: ${validNames.join(', ')}`,
      );
    }
  }
}
