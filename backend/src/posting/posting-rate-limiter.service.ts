import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * X API v2 rate limits for tweet creation (per-user, per-app):
 * - Free tier: 17 tweets per 24 hours per user
 * - Basic tier: 100 tweets per 24 hours per user
 *
 * This service enforces a sliding-window rate limit using Redis
 * to prevent hitting X API limits and getting the app suspended.
 */
@Injectable()
export class PostingRateLimiter {
  private readonly logger = new Logger(PostingRateLimiter.name);
  private readonly redis: Redis;

  /** Default: 17 posts/24h (X free-tier limit). Override via TWITTER_RATE_LIMIT_PER_DAY. */
  private readonly maxPerDay: number;
  private readonly windowMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host')!;
    const port = this.configService.get<number>('redis.port')!;
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.connect().catch((err) => {
      this.logger.error('Redis connection failed for rate limiter', err);
    });

    this.maxPerDay = parseInt(
      this.configService.get<string>('TWITTER_RATE_LIMIT_PER_DAY') || '17',
      10,
    );
  }

  /**
   * Check whether the given X account can post right now.
   * Does NOT consume a slot — call `record()` after a successful post.
   */
  async canPost(xAccountId: string): Promise<boolean> {
    const count = await this.getCurrentCount(xAccountId);
    return count < this.maxPerDay;
  }

  /**
   * Record a successful post for the given X account.
   * Uses a Redis sorted set with timestamps as scores for a sliding window.
   */
  async record(xAccountId: string): Promise<void> {
    const key = this.redisKey(xAccountId);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const pipeline = this.redis.pipeline();
    // Add current timestamp
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
    // Remove entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Set TTL so keys self-clean
    pipeline.expire(key, Math.ceil(this.windowMs / 1000) + 60);
    await pipeline.exec();
  }

  /**
   * Get remaining posts allowed in the current window.
   */
  async getRemainingQuota(xAccountId: string): Promise<number> {
    const count = await this.getCurrentCount(xAccountId);
    return Math.max(0, this.maxPerDay - count);
  }

  /**
   * Get the earliest time a new post will be allowed (if currently rate-limited).
   * Returns null if posting is allowed now.
   */
  async getNextAvailableTime(xAccountId: string): Promise<Date | null> {
    const count = await this.getCurrentCount(xAccountId);
    if (count < this.maxPerDay) return null;

    // Find the oldest entry — the window opens when it falls off
    const key = this.redisKey(xAccountId);
    const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    if (oldest.length < 2) return null;

    const oldestTimestamp = parseInt(oldest[1], 10);
    return new Date(oldestTimestamp + this.windowMs);
  }

  private async getCurrentCount(xAccountId: string): Promise<number> {
    const key = this.redisKey(xAccountId);
    const windowStart = Date.now() - this.windowMs;

    // Clean expired entries and count remaining
    await this.redis.zremrangebyscore(key, 0, windowStart);
    return this.redis.zcard(key);
  }

  private redisKey(xAccountId: string): string {
    return `rate:xpost:${xAccountId}`;
  }
}
