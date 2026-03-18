import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Per-bot rate limiter that enforces daily tweet limits based on subscription plans.
 *
 * Works alongside the PostingRateLimiter (which enforces X API account-level limits).
 * This limits how many tweets a single bot can generate/post per day,
 * preventing a single bot from consuming the entire account's quota.
 */
@Injectable()
export class BotRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(BotRateLimiter.name);
  private readonly redis: Redis;
  private readonly windowMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host')!;
    const port = this.configService.get<number>('redis.port')!;
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.connect().catch((err) => {
      this.logger.error('Redis connection failed for bot rate limiter', err);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Check if a bot can generate/post another tweet within its daily limit.
   * @param botId - The bot ID
   * @param maxPerDay - Limit from the subscription plan (e.g., plan.maxTweetsPerDay / plan.maxBots)
   */
  async canProceed(botId: string, maxPerDay: number): Promise<boolean> {
    const count = await this.getCurrentCount(botId);
    return count < maxPerDay;
  }

  /**
   * Record a tweet generation/post for a bot.
   */
  async record(botId: string): Promise<void> {
    const key = this.redisKey(botId);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.expire(key, Math.ceil(this.windowMs / 1000) + 60);
    await pipeline.exec();
  }

  /**
   * Get how many tweets the bot has generated in the current 24h window.
   */
  async getCurrentCount(botId: string): Promise<number> {
    const key = this.redisKey(botId);
    const windowStart = Date.now() - this.windowMs;
    await this.redis.zremrangebyscore(key, 0, windowStart);
    return this.redis.zcard(key);
  }

  /**
   * Get remaining quota for a bot.
   */
  async getRemainingQuota(botId: string, maxPerDay: number): Promise<number> {
    const count = await this.getCurrentCount(botId);
    return Math.max(0, maxPerDay - count);
  }

  private redisKey(botId: string): string {
    return `rate:bot:${botId}`;
  }
}
