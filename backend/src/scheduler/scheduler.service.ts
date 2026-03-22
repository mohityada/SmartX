import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma';
import { QUEUES, DEFAULT_JOB_OPTS } from './queue.constants';
import { BotRateLimiter } from './bot-rate-limiter.service';

export const POSTING_QUEUE = QUEUES.TWEET_POSTING;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.TWEET_POSTING) private readonly postingQueue: Queue,
    private readonly botRateLimiter: BotRateLimiter,
  ) {}

  /**
   * Schedule an approved tweet for posting at a specific time.
   * Creates a delayed BullMQ job and a scheduled_tweets record.
   */
  async scheduleTweet(tweetId: string, scheduledFor: Date) {
    const tweet = await this.prisma.tweet.findUniqueOrThrow({
      where: { id: tweetId },
      include: { bot: true },
    });

    // Check per-bot daily limit
    const dailyLimit = await this.getBotDailyLimit(tweet.bot.userId);
    const canProceed = await this.botRateLimiter.canProceed(
      tweet.botId,
      dailyLimit,
    );
    if (!canProceed) {
      const remaining = await this.botRateLimiter.getRemainingQuota(
        tweet.botId,
        dailyLimit,
      );
      this.logger.warn(
        `Bot ${tweet.botId} has hit its daily limit (${dailyLimit}). Remaining: ${remaining}`,
      );
      throw new Error(`Bot has reached its daily tweet limit of ${dailyLimit}`);
    }

    const delay = Math.max(0, scheduledFor.getTime() - Date.now());

    const job = await this.postingQueue.add(
      'post-tweet',
      { tweetId },
      {
        delay,
        ...DEFAULT_JOB_OPTS[QUEUES.TWEET_POSTING],
        jobId: `post-${tweetId}`, // Prevent duplicate scheduling
      },
    );

    const scheduled = await this.prisma.scheduledTweet.create({
      data: {
        tweetId,
        scheduledFor,
        jobId: job.id,
        status: 'pending',
      },
    });

    await this.prisma.tweet.update({
      where: { id: tweetId },
      data: { status: 'scheduled' },
    });

    this.logger.log(
      `Scheduled tweet ${tweetId} for ${scheduledFor.toISOString()} (job ${job.id})`,
    );

    return scheduled;
  }

  /**
   * Cancel any existing delayed job and immediately enqueue the tweet for posting.
   */
  async postImmediately(tweetId: string) {
    // Remove existing delayed job (idempotent — OK if not found)
    const existingJob = await this.postingQueue.getJob(`post-${tweetId}`);
    if (existingJob) {
      await existingJob.remove();
    }

    const job = await this.postingQueue.add(
      'post-tweet',
      { tweetId },
      {
        ...DEFAULT_JOB_OPTS[QUEUES.TWEET_POSTING],
        jobId: `post-${tweetId}`,
      },
    );

    // Update scheduledTweet record to reflect immediate scheduling
    await this.prisma.scheduledTweet.updateMany({
      where: { tweetId, status: 'pending' },
      data: { scheduledFor: new Date(), jobId: job.id },
    });

    this.logger.log(
      `Post-immediately enqueued tweet ${tweetId} (job ${job.id})`,
    );
    return job;
  }

  /**
   * Auto-schedule a batch of approved tweets for a bot using its posting frequency.
   * Distributes tweets evenly across active hours (8am-11pm in UTC).
   */
  async autoScheduleForBot(botId: string): Promise<number> {
    const bot = await this.prisma.bot.findUniqueOrThrow({
      where: { id: botId },
    });

    // Get unscheduled approved tweets
    const approvedTweets = await this.prisma.tweet.findMany({
      where: {
        botId,
        status: 'approved',
        scheduledTweet: null,
      },
      orderBy: { createdAt: 'asc' },
      take: bot.postingFrequency,
    });

    if (!approvedTweets.length) return 0;

    // Check how many slots remain for today
    const dailyLimit = await this.getBotDailyLimit(bot.userId);
    const remaining = await this.botRateLimiter.getRemainingQuota(
      botId,
      dailyLimit,
    );
    const toSchedule = approvedTweets.slice(0, remaining);

    if (!toSchedule.length) {
      this.logger.debug(`Bot ${botId}: no remaining quota for today`);
      return 0;
    }

    // Calculate time slots using bot's custom posting window
    const slots = this.calculateTimeSlots(
      toSchedule.length,
      bot.postingFrequency,
      bot.scheduleStartHour,
      bot.scheduleEndHour,
    );

    let scheduled = 0;
    for (let i = 0; i < toSchedule.length; i++) {
      try {
        await this.scheduleTweet(toSchedule[i].id, slots[i]);
        scheduled++;
      } catch (err) {
        this.logger.warn(
          `Failed to schedule tweet ${toSchedule[i].id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(`Auto-scheduled ${scheduled} tweets for bot ${botId}`);
    return scheduled;
  }

  /**
   * Cron: every 10 minutes, auto-schedule approved tweets for all active bots.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoScheduleAll() {
    const activeBots = await this.prisma.bot.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    this.logger.log(`Auto-scheduling for ${activeBots.length} active bots`);

    for (const bot of activeBots) {
      try {
        await this.autoScheduleForBot(bot.id);
      } catch (err) {
        this.logger.error(
          `Auto-schedule failed for bot ${bot.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Cron: every 10 minutes, check for stale scheduled tweets that should
   * have been posted but are still pending (missed by delayed job).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async recoverStaleScheduledTweets() {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 min overdue

    const staleTweets = await this.prisma.scheduledTweet.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lt: staleThreshold },
      },
      include: { tweet: { select: { id: true, status: true } } },
      take: 50,
    });

    if (!staleTweets.length) return;

    this.logger.warn(
      `Found ${staleTweets.length} stale scheduled tweets — re-enqueuing`,
    );

    for (const st of staleTweets) {
      if (st.tweet.status === 'posted') {
        // Already posted by another mechanism — just mark complete
        await this.prisma.scheduledTweet.update({
          where: { id: st.id },
          data: { status: 'completed' },
        });
        continue;
      }

      try {
        await this.postingQueue.add(
          'post-tweet',
          { tweetId: st.tweet.id },
          {
            ...DEFAULT_JOB_OPTS[QUEUES.TWEET_POSTING],
            jobId: `recover-${st.tweet.id}-${Date.now()}`,
          },
        );

        await this.prisma.scheduledTweet.update({
          where: { id: st.id },
          data: { status: 'processing', lastAttemptedAt: new Date() },
        });
      } catch (err) {
        this.logger.error(
          `Failed to recover stale tweet ${st.tweet.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Cancel a scheduled tweet — removes the BullMQ job and marks as draft again.
   */
  async cancelScheduledTweet(tweetId: string, userId: string) {
    const tweet = await this.prisma.tweet.findUniqueOrThrow({
      where: { id: tweetId },
      include: { bot: true, scheduledTweet: true },
    });

    if (tweet.bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (!tweet.scheduledTweet) {
      throw new Error('Tweet is not scheduled');
    }

    // Remove the BullMQ job if it still exists
    if (tweet.scheduledTweet.jobId) {
      const job = await this.postingQueue.getJob(tweet.scheduledTweet.jobId);
      if (job) {
        await job.remove();
      }
    }

    await this.prisma.scheduledTweet.delete({
      where: { id: tweet.scheduledTweet.id },
    });

    await this.prisma.tweet.update({
      where: { id: tweetId },
      data: { status: 'approved' },
    });

    this.logger.log(`Cancelled scheduled tweet ${tweetId}`);
  }

  /**
   * Get all pending scheduled tweets for a user's bots.
   */
  async findPendingByUser(userId: string) {
    return this.prisma.scheduledTweet.findMany({
      where: {
        status: 'pending',
        tweet: { bot: { userId } },
      },
      include: {
        tweet: { select: { content: true, bot: { select: { name: true } } } },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Distribute N tweets across active hours.
   * Uses the bot's posting frequency and custom schedule window.
   */
  private calculateTimeSlots(
    count: number,
    frequency: number,
    startHour = 8,
    endHour = 23,
  ): Date[] {
    const now = new Date();
    const slots: Date[] = [];

    const activeHours = endHour - startHour;
    if (activeHours <= 0) return slots;

    // Minutes between posts to evenly distribute across the day
    const intervalMinutes = Math.floor(
      (activeHours * 60) / Math.max(frequency, 1),
    );

    // Start from the next available slot after now
    const todayStart = new Date(now);
    todayStart.setUTCHours(startHour, 0, 0, 0);

    // If we're past today's window, start tomorrow
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(endHour, 0, 0, 0);

    let baseTime: Date;
    if (now >= todayEnd) {
      // Schedule for tomorrow
      baseTime = new Date(todayStart);
      baseTime.setUTCDate(baseTime.getUTCDate() + 1);
    } else if (now < todayStart) {
      baseTime = todayStart;
    } else {
      // Start from the next interval boundary after now
      const minutesSinceStart =
        (now.getTime() - todayStart.getTime()) / (60 * 1000);
      const nextSlotIndex = Math.ceil(minutesSinceStart / intervalMinutes);
      baseTime = new Date(
        todayStart.getTime() + nextSlotIndex * intervalMinutes * 60 * 1000,
      );
    }

    for (let i = 0; i < count; i++) {
      const slotTime = new Date(
        baseTime.getTime() + i * intervalMinutes * 60 * 1000,
      );

      // Add a small random jitter (0-5 min) to look more organic
      const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000);
      const finalTime = new Date(slotTime.getTime() + jitterMs);

      slots.push(finalTime);
    }

    return slots;
  }

  /**
   * Resolve the daily tweet limit for a bot's owner.
   * Falls back to a sensible default if no subscription is found.
   */
  private async getBotDailyLimit(userId: string): Promise<number> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub || !sub.plan) {
      // Free-tier default
      return 4;
    }

    return sub.plan.maxTweetsPerDay;
  }
}
