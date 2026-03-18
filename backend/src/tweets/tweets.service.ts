import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class TweetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
  ) {}

  async findAllByUser(
    userId: string,
    filters: { status?: string; botId?: string },
  ) {
    return this.prisma.tweet.findMany({
      where: {
        bot: { userId },
        ...(filters.status && { status: filters.status }),
        ...(filters.botId && { botId: filters.botId }),
      },
      include: {
        bot: { select: { name: true } },
        event: { select: { title: true, source: true } },
        scheduledTweet: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, userId: string) {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id },
      include: {
        bot: { select: { name: true, userId: true } },
        event: true,
        scheduledTweet: true,
      },
    });

    if (!tweet) throw new NotFoundException('Tweet not found');
    if (tweet.bot.userId !== userId) throw new ForbiddenException();

    return tweet;
  }

  async approve(id: string, userId: string) {
    const tweet = await this.findOne(id, userId);
    if (tweet.status !== 'draft') {
      throw new ForbiddenException('Only draft tweets can be approved');
    }

    return this.prisma.tweet.update({
      where: { id },
      data: { status: 'approved' },
    });
  }

  async postNow(id: string, userId: string) {
    const tweet = await this.findOne(id, userId);
    if (!['draft', 'approved', 'scheduled'].includes(tweet.status)) {
      throw new ForbiddenException(
        `Cannot post a tweet with status '${tweet.status}'`,
      );
    }

    // If already in the delayed queue, cancel it and re-enqueue immediately
    if (tweet.status === 'scheduled') {
      return this.scheduler.postImmediately(id);
    }

    // Auto-approve if still draft
    if (tweet.status === 'draft') {
      await this.prisma.tweet.update({
        where: { id },
        data: { status: 'approved' },
      });
    }

    return this.scheduler.scheduleTweet(id, new Date());
  }
}
