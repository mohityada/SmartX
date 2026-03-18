/**
 * Centralized queue name constants and default job-options for all BullMQ queues.
 * Single source of truth — every module imports from here.
 */

// ─── Queue Names ────────────────────────────────────────────────────
export const QUEUES = {
  EVENT_INGESTION: 'event-ingestion',
  EVENT_PROCESSING: 'event-processing',
  TWEET_POSTING: 'tweet-posting',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ─── Default Job Options ────────────────────────────────────────────
export const DEFAULT_JOB_OPTS = {
  /** Event ingestion (fetch from external APIs) */
  [QUEUES.EVENT_INGESTION]: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 10_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },

  /** AI generation (Claude API calls) */
  [QUEUES.EVENT_PROCESSING]: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },

  /** Tweet posting (X API calls) */
  [QUEUES.TWEET_POSTING]: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 30_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
} as const;

// ─── Worker Concurrency ─────────────────────────────────────────────
export const WORKER_CONCURRENCY = {
  [QUEUES.EVENT_INGESTION]: 4,
  [QUEUES.EVENT_PROCESSING]: 5,
  [QUEUES.TWEET_POSTING]: 3,
} as const;
