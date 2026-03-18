import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './queue.constants';
import { QueueHealthStatus } from './queue-events.listener';

/**
 * Provides health check and stats for all BullMQ queues.
 * Used by the admin/queue controller and can be wired to health-check endpoints.
 */
@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);

  constructor(
    @InjectQueue(QUEUES.EVENT_INGESTION)
    private readonly ingestionQueue: Queue,
    @InjectQueue(QUEUES.EVENT_PROCESSING)
    private readonly processingQueue: Queue,
    @InjectQueue(QUEUES.TWEET_POSTING)
    private readonly postingQueue: Queue,
  ) {}

  /**
   * Get counts for all queues.
   */
  async getAllQueueStats(): Promise<QueueHealthStatus[]> {
    const queues: [string, Queue][] = [
      [QUEUES.EVENT_INGESTION, this.ingestionQueue],
      [QUEUES.EVENT_PROCESSING, this.processingQueue],
      [QUEUES.TWEET_POSTING, this.postingQueue],
    ];

    const stats: QueueHealthStatus[] = [];

    for (const [name, queue] of queues) {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      );
      stats.push({
        name: name as QueueHealthStatus['name'],
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0,
      });
    }

    return stats;
  }

  /**
   * Get stats for a single queue.
   */
  async getQueueStats(queueName: string): Promise<QueueHealthStatus | null> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return null;

    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );

    return {
      name: queueName as QueueHealthStatus['name'],
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  }

  /**
   * Drain all failed jobs from a queue (admin operation).
   */
  async cleanFailedJobs(queueName: string, gracePeriodMs = 0): Promise<number> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return 0;

    const removed = await queue.clean(gracePeriodMs, 1000, 'failed');
    this.logger.log(`Cleaned ${removed.length} failed jobs from ${queueName}`);
    return removed.length;
  }

  /**
   * Retry all failed jobs in a queue.
   */
  async retryFailedJobs(queueName: string): Promise<number> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return 0;

    const failed = await queue.getFailed(0, 100);
    let retried = 0;

    for (const job of failed) {
      await job.retry();
      retried++;
    }

    this.logger.log(`Retried ${retried} failed jobs in ${queueName}`);
    return retried;
  }

  /**
   * Pause a queue (stop processing new jobs).
   */
  async pauseQueue(queueName: string): Promise<boolean> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return false;
    await queue.pause();
    this.logger.warn(`Queue ${queueName} paused`);
    return true;
  }

  /**
   * Resume a paused queue.
   */
  async resumeQueue(queueName: string): Promise<boolean> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return false;
    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
    return true;
  }

  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case QUEUES.EVENT_INGESTION:
        return this.ingestionQueue;
      case QUEUES.EVENT_PROCESSING:
        return this.processingQueue;
      case QUEUES.TWEET_POSTING:
        return this.postingQueue;
      default:
        return null;
    }
  }
}
