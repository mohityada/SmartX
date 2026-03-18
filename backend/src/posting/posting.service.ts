import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma';
import { XApiClientService } from './x-api-client.service';
import { PostingRateLimiter } from './posting-rate-limiter.service';
import {
  NonRetryablePostingError,
  RateLimitedError,
  classifyTwitterError,
} from './posting-errors';

@Injectable()
export class PostingService {
  private readonly logger = new Logger(PostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xApiClient: XApiClientService,
    private readonly rateLimiter: PostingRateLimiter,
  ) {}

  /**
   * Post a tweet to X via API v2.
   * Retrieves the bot's linked X account, checks rate limits,
   * publishes the tweet, and updates all related records.
   *
   * Throws:
   * - NonRetryablePostingError for permanent failures (no linked account, bad content)
   * - RateLimitedError when the X account has hit its daily posting limit
   * - Regular Error for transient/retryable failures
   */
  async postTweet(tweetId: string): Promise<void> {
    const tweet = await this.prisma.tweet.findUniqueOrThrow({
      where: { id: tweetId },
      include: {
        bot: { include: { xAccount: true } },
        scheduledTweet: true,
      },
    });

    // Guard: already posted
    if (tweet.status === 'posted') {
      this.logger.warn(`Tweet ${tweetId} already posted — skipping`);
      return;
    }

    // Guard: no X account linked
    const xAccount = tweet.bot.xAccount;
    if (!xAccount) {
      const msg = 'No X account linked to bot';
      await this.markFailed(tweetId, msg);
      throw new NonRetryablePostingError(msg, tweetId);
    }

    // Guard: rate limit check
    const canPost = await this.rateLimiter.canPost(xAccount.id);
    if (!canPost) {
      const nextAvailable = await this.rateLimiter.getNextAvailableTime(xAccount.id);
      const retryAfterMs = nextAvailable
        ? Math.max(0, nextAvailable.getTime() - Date.now()) + 1000
        : 15 * 60 * 1000;

      this.logger.warn(
        `Rate limited for X account ${xAccount.xUsername}. Next available: ${nextAvailable?.toISOString() ?? 'unknown'}`,
      );
      throw new RateLimitedError(
        `X account ${xAccount.xUsername} rate limited`,
        retryAfterMs,
      );
    }

    // Mark as processing in scheduled_tweets if applicable
    if (tweet.scheduledTweet) {
      await this.prisma.scheduledTweet.update({
        where: { id: tweet.scheduledTweet.id },
        data: {
          status: 'processing',
          attempts: { increment: 1 },
          lastAttemptedAt: new Date(),
        },
      });
    }

    try {
      const result = await this.xApiClient.postTweet(xAccount.id, tweet.content);

      // Record the post for rate-limiting
      await this.rateLimiter.record(xAccount.id);

      // Update tweet record
      await this.prisma.tweet.update({
        where: { id: tweetId },
        data: {
          status: 'posted',
          xTweetId: result.xTweetId,
          postedAt: new Date(),
          errorMessage: null,
        },
      });

      // Mark scheduled tweet as completed
      if (tweet.scheduledTweet) {
        await this.prisma.scheduledTweet.update({
          where: { id: tweet.scheduledTweet.id },
          data: { status: 'completed' },
        });
      }

      // Log activity
      await this.prisma.botActivityLog.create({
        data: {
          botId: tweet.botId,
          action: 'tweet_posted',
          metadata: {
            tweetId,
            xTweetId: result.xTweetId,
            xAccountId: xAccount.id,
          },
        },
      });

      this.logger.log(
        `Posted tweet ${tweetId} as X tweet ${result.xTweetId} via @${xAccount.xUsername}`,
      );
    } catch (error) {
      const classified = classifyTwitterError(error);

      await this.prisma.botActivityLog.create({
        data: {
          botId: tweet.botId,
          action: 'tweet_post_failed',
          metadata: {
            tweetId,
            error: classified.message,
            retryable: classified.retryable,
          },
        },
      });

      if (!classified.retryable) {
        await this.markFailed(tweetId, classified.message);
        throw new NonRetryablePostingError(classified.message, tweetId);
      }

      if (classified.retryAfterMs) {
        // Update error message but keep status for retry
        await this.prisma.tweet.update({
          where: { id: tweetId },
          data: { errorMessage: classified.message },
        });
        throw new RateLimitedError(classified.message, classified.retryAfterMs);
      }

      // Retryable transient error — update error message and re-throw for BullMQ retry
      await this.prisma.tweet.update({
        where: { id: tweetId },
        data: { errorMessage: classified.message },
      });
      this.logger.warn(
        `Retryable error posting tweet ${tweetId}: ${classified.message}`,
      );
      throw error;
    }
  }

  private async markFailed(tweetId: string, errorMessage: string) {
    await this.prisma.tweet.update({
      where: { id: tweetId },
      data: { status: 'failed', errorMessage },
    });

    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { scheduledTweet: true },
    });

    if (tweet?.scheduledTweet) {
      await this.prisma.scheduledTweet.update({
        where: { id: tweet.scheduledTweet.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastAttemptedAt: new Date(),
        },
      });
    }

    this.logger.error(`Tweet ${tweetId} permanently failed: ${errorMessage}`);
  }
}
