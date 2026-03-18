import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBotSummary(botId: string, userId: string) {
    const bot = await this.prisma.bot.findFirst({
      where: { id: botId, userId },
    });
    if (!bot) return null;

    const [totalTweets, postedTweets, failedTweets, tweetStats] =
      await Promise.all([
        this.prisma.tweet.count({ where: { botId } }),
        this.prisma.tweet.count({ where: { botId, status: 'posted' } }),
        this.prisma.tweet.count({ where: { botId, status: 'failed' } }),
        this.prisma.tweet.aggregate({
          where: { botId, status: 'posted' },
          _sum: { impressions: true, likes: true, retweets: true },
        }),
      ]);

    return {
      botId,
      botName: bot.name,
      totalTweets,
      postedTweets,
      failedTweets,
      totalImpressions: tweetStats._sum.impressions ?? 0,
      totalLikes: tweetStats._sum.likes ?? 0,
      totalRetweets: tweetStats._sum.retweets ?? 0,
    };
  }

  async getRecentActivity(botId: string, limit = 20) {
    return this.prisma.botActivityLog.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
