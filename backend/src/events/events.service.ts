import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma';
import { EventSourceAdapter, NormalizedEvent } from './adapters';
import { QUEUES, DEFAULT_JOB_OPTS } from '../scheduler/queue.constants';

/** @deprecated Use QUEUES.EVENT_PROCESSING from queue.constants instead */
export const EVENT_QUEUE = QUEUES.EVENT_PROCESSING;
/** @deprecated Use QUEUES.EVENT_INGESTION from queue.constants instead */
export const INGESTION_QUEUE = QUEUES.EVENT_INGESTION;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('EVENT_SOURCE_ADAPTERS')
    private readonly adapters: EventSourceAdapter[],
    @InjectQueue(QUEUES.EVENT_PROCESSING) private readonly eventQueue: Queue,
    @InjectQueue(QUEUES.EVENT_INGESTION) private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Cron job: enqueues one ingestion job per adapter every 5 minutes.
   * The actual fetching happens in IngestionProcessor workers,
   * giving us parallel execution, retries, and backoff for free via BullMQ.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleIngestion() {
    this.logger.log(
      `Scheduling ingestion for ${this.adapters.length} adapters`,
    );

    for (const adapter of this.adapters) {
      await this.ingestionQueue.add(
        'ingest',
        { adapterSource: adapter.source },
        DEFAULT_JOB_OPTS[QUEUES.EVENT_INGESTION],
      );
    }
  }

  /**
   * Process a single normalized event: deduplicate, persist, and fan-out
   * to the AI generation queue for every subscribed active bot.
   *
   * Returns `true` if the event was newly created, `false` if it already existed.
   */
  async ingestSingleEvent(event: NormalizedEvent): Promise<boolean> {
    // Dedup by source + externalId
    const existing = await this.prisma.event.findUnique({
      where: {
        source_externalId: {
          source: event.source,
          externalId: event.externalId,
        },
      },
    });

    if (existing) return false;

    const created = await this.prisma.event.create({ data: event });

    // Find all active bots subscribed to this source + category
    const subscribers = await this.prisma.botEventSubscription.findMany({
      where: {
        source: event.source,
        category: event.category,
      },
      include: { bot: { select: { id: true, isActive: true } } },
    });

    // Enqueue AI generation jobs for active bots
    const jobs = subscribers
      .filter((sub) => sub.bot.isActive)
      .map((sub) => ({
        name: 'generate-tweet',
        data: { eventId: created.id, botId: sub.botId },
        opts: DEFAULT_JOB_OPTS[QUEUES.EVENT_PROCESSING],
      }));

    if (jobs.length) {
      await this.eventQueue.addBulk(jobs);
      this.logger.debug(
        `Enqueued ${jobs.length} generate-tweet jobs for event ${created.id}`,
      );
    }

    return true;
  }

  /**
   * Query persisted events with optional filters.
   */
  async findAll(options: {
    category?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }) {
    const { category, source, limit = 50, offset = 0 } = options;

    const where: Record<string, string> = {};
    if (category) where.category = category;
    if (source) where.source = source;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total, limit, offset };
  }

  /**
   * Get ingestion queue health metrics.
   */
  async getQueueHealth() {
    const [ingestionCounts, processingCounts] = await Promise.all([
      this.ingestionQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.eventQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
    ]);

    return {
      ingestionQueue: ingestionCounts,
      processingQueue: processingCounts,
      adapters: this.adapters.map((a) => a.source),
    };
  }
}
