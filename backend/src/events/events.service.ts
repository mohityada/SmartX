import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma';
import { EventSourceAdapter, NormalizedEvent } from './adapters';
import { QUEUES, DEFAULT_JOB_OPTS } from '../scheduler/queue.constants';

/**
 * How far back (in hours) to look for similar events when deduplicating
 * across different sources. A Cricbuzz article and an ESPN article about
 * the same match posted within this window will be treated as duplicates.
 */
const DEDUP_WINDOW_HOURS = 24;

/**
 * Jaccard bigram similarity threshold for cross-source event title matching.
 * 0.35 is intentionally lower than tweet-level (0.6) because titles from
 * different sites use varied wording for the same story.
 */
const EVENT_TITLE_SIMILARITY_THRESHOLD = 0.35;

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
    // 1. Exact dedup by source + externalId
    const existing = await this.prisma.event.findUnique({
      where: {
        source_externalId: {
          source: event.source,
          externalId: event.externalId,
        },
      },
    });

    if (existing) return false;

    // 2. Cross-source fuzzy dedup: skip if a similar event title was
    //    already ingested within the dedup window (from ANY source).
    const cutoff = new Date(
      Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const recentEvents = await this.prisma.event.findMany({
      where: { ingestedAt: { gte: cutoff }, category: event.category },
      orderBy: { ingestedAt: 'desc' },
      take: 100,
      select: { id: true, title: true },
    });

    const candidateBigrams = this.getBigrams(event.title);
    for (const recent of recentEvents) {
      const sim = this.jaccardSimilarity(
        candidateBigrams,
        this.getBigrams(recent.title),
      );
      if (sim >= EVENT_TITLE_SIMILARITY_THRESHOLD) {
        this.logger.debug(
          `Skipping duplicate event "${event.title.slice(0, 60)}…" ` +
            `(similar to existing event ${recent.id}, similarity=${sim.toFixed(2)})`,
        );
        return false;
      }
    }

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

  // ── Similarity helpers (shared with AiGenerationService pattern) ─────

  private getBigrams(text: string): Set<string> {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
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
