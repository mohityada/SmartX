import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DelayedError, Job, UnrecoverableError } from 'bullmq';
import { PostingService } from './posting.service';
import { NonRetryablePostingError, RateLimitedError } from './posting-errors';
import { QUEUES, WORKER_CONCURRENCY } from '../scheduler/queue.constants';

interface PostTweetJobData {
  tweetId: string;
}

/**
 * BullMQ processor for the tweet-posting queue.
 *
 * Retry strategy:
 * - NonRetryablePostingError → immediately fails the job (no more retries)
 * - RateLimitedError → delays the job by the specified amount
 * - Other errors → default BullMQ exponential backoff (configured by the scheduler)
 */
@Processor(QUEUES.TWEET_POSTING, {
  concurrency: WORKER_CONCURRENCY[QUEUES.TWEET_POSTING],
  limiter: {
    max: 10,
    duration: 60_000, // max 10 jobs per minute across all workers
  },
})
export class PostingProcessor extends WorkerHost {
  private readonly logger = new Logger(PostingProcessor.name);

  constructor(private readonly postingService: PostingService) {
    super();
  }

  async process(job: Job<PostTweetJobData>): Promise<void> {
    const { tweetId } = job.data;
    this.logger.log(
      `Processing posting job ${job.id}: tweet=${tweetId} (attempt ${job.attemptsMade + 1}/${(job.opts.attempts ?? 3) + 1})`,
    );

    try {
      await this.postingService.postTweet(tweetId);
    } catch (error) {
      if (error instanceof NonRetryablePostingError) {
        this.logger.error(
          `Non-retryable failure for tweet ${tweetId}: ${error.message}`,
        );
        throw new UnrecoverableError(error.message);
      }

      if (error instanceof RateLimitedError) {
        this.logger.warn(
          `Rate limited for tweet ${tweetId}. Delaying ${Math.round(error.retryAfterMs / 1000)}s`,
        );
        // Move the job to delayed state with the specified delay
        await job.moveToDelayed(Date.now() + error.retryAfterMs, job.token);
        throw new DelayedError();
      }

      // All other errors: let BullMQ handle with its default retry/backoff
      throw error;
    }
  }
}
