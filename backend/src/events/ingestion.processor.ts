import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventSourceAdapter } from './adapters';
import { EventsService } from './events.service';
import { QUEUES, WORKER_CONCURRENCY } from '../scheduler/queue.constants';

export interface IngestionJobData {
  adapterSource: string;
}

/**
 * BullMQ worker that processes event ingestion jobs.
 *
 * Each job targets a single adapter (identified by `adapterSource`).
 * The cron scheduler enqueues one job per adapter every 5 minutes,
 * letting BullMQ handle concurrency, retries, and backoff.
 */
@Processor(QUEUES.EVENT_INGESTION, {
  concurrency: WORKER_CONCURRENCY[QUEUES.EVENT_INGESTION],
})
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);
  private readonly adapterMap: Map<string, EventSourceAdapter>;

  constructor(
    @Inject('EVENT_SOURCE_ADAPTERS')
    adapters: EventSourceAdapter[],
    private readonly eventsService: EventsService,
  ) {
    super();
    this.adapterMap = new Map(adapters.map((a) => [a.source, a]));
  }

  async process(job: Job<IngestionJobData>): Promise<number> {
    const { adapterSource } = job.data;
    const adapter = this.adapterMap.get(adapterSource);

    if (!adapter) {
      this.logger.warn(`Unknown adapter source: ${adapterSource}`);
      return 0;
    }

    this.logger.log(`Ingesting events from "${adapterSource}" (job ${job.id})`);

    const events = await adapter.fetchEvents();
    const newEventIds: string[] = [];

    for (const event of events) {
      const eventId = await this.eventsService.ingestSingleEvent(event);
      if (eventId) newEventIds.push(eventId);
    }

    // Batch fan-out: one job per bot (instead of one per event per bot)
    if (newEventIds.length) {
      await this.eventsService.fanOutBatchJobs(newEventIds);
    }

    this.logger.log(
      `Adapter "${adapterSource}": ${newEventIds.length} new events out of ${events.length} fetched`,
    );

    return newEventIds.length;
  }
}
