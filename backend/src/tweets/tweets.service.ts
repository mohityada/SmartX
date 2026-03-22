import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EditTweetDto } from './dto/edit-tweet.dto';
import { ScheduleTweetDto } from './dto/schedule-tweet.dto';

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

  async editTweet(id: string, userId: string, dto: EditTweetDto) {
    const tweet = await this.findOne(id, userId);
    if (!['draft', 'approved'].includes(tweet.status)) {
      throw new ForbiddenException(
        `Cannot edit a tweet with status '${tweet.status}'`,
      );
    }

    return this.prisma.tweet.update({
      where: { id },
      data: { content: dto.content },
      include: {
        bot: { select: { name: true } },
        event: { select: { title: true, source: true } },
        scheduledTweet: true,
      },
    });
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

  async scheduleAt(id: string, userId: string, dto: ScheduleTweetDto) {
    const tweet = await this.findOne(id, userId);
    if (!['draft', 'approved'].includes(tweet.status)) {
      throw new ForbiddenException(
        `Cannot schedule a tweet with status '${tweet.status}'`,
      );
    }

    const scheduledFor = new Date(dto.scheduledFor);
    if (scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Auto-approve if still draft
    if (tweet.status === 'draft') {
      await this.prisma.tweet.update({
        where: { id },
        data: { status: 'approved' },
      });
    }

    return this.scheduler.scheduleTweet(id, scheduledFor);
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
