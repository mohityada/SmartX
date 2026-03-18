import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { QUEUES, QueueName } from './queue.constants';

/**
 * Listens to global BullMQ queue events for all queues.
 * Provides structured logging for job lifecycle events
 * and exposes health-check information.
 */
@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsListener.name);
  private readonly listeners: QueueEvents[] = [];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = {
      host: this.configService.get<string>('redis.host')!,
      port: this.configService.get<number>('redis.port')!,
    };

    for (const queueName of Object.values(QUEUES)) {
      const queueEvents = new QueueEvents(queueName, { connection });

      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        this.logger.debug(
          `[${queueName}] Job ${jobId} completed${returnvalue ? `: ${returnvalue}` : ''}`,
        );
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(
          `[${queueName}] Job ${jobId} failed: ${failedReason}`,
        );
      });

      queueEvents.on('stalled', ({ jobId }) => {
        this.logger.warn(`[${queueName}] Job ${jobId} stalled`);
      });

      queueEvents.on('delayed', ({ jobId, delay }) => {
        this.logger.debug(`[${queueName}] Job ${jobId} delayed by ${delay}ms`);
      });

      this.listeners.push(queueEvents);
    }

    this.logger.log(
      `Queue event listeners started for: ${Object.values(QUEUES).join(', ')}`,
    );
  }

  async onModuleDestroy() {
    for (const listener of this.listeners) {
      await listener.close();
    }
  }
}

export interface QueueHealthStatus {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}
