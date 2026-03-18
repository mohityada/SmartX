import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { BotRateLimiter } from './bot-rate-limiter.service';
import { QueueEventsListener } from './queue-events.listener';
import { QueueHealthService } from './queue-health.service';
import { QueueAdminController } from './queue-admin.controller';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.EVENT_INGESTION },
      { name: QUEUES.EVENT_PROCESSING },
      { name: QUEUES.TWEET_POSTING },
    ),
  ],
  controllers: [QueueAdminController],
  providers: [
    SchedulerService,
    BotRateLimiter,
    QueueEventsListener,
    QueueHealthService,
  ],
  exports: [SchedulerService, BotRateLimiter],
})
export class SchedulerModule {}
