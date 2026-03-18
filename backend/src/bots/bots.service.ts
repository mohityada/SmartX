import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma';
import { CreateBotDto, UpdateBotDto } from './dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBotDto) {
    const { topics, eventSubscriptions, xAccountId, ...botData } = dto;

    const bot = await this.prisma.bot.create({
      data: {
        ...botData,
        userId,
        xAccountId: xAccountId || undefined,
        topics: topics?.length
          ? { create: topics.map((topic) => ({ topic })) }
          : undefined,
        eventSubscriptions: eventSubscriptions?.length
          ? {
              create: eventSubscriptions.map((es) => ({
                source: es.source,
                category: es.category,
              })),
            }
          : undefined,
      },
      include: { topics: true, eventSubscriptions: true },
    });

    await this.logActivity(bot.id, 'bot_created');

    return bot;
  }

  async findAllByUser(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      include: {
        topics: true,
        eventSubscriptions: true,
        xAccount: { select: { xUsername: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id },
      include: {
        topics: true,
        eventSubscriptions: true,
        xAccount: { select: { xUsername: true } },
      },
    });

    if (!bot) throw new NotFoundException('Bot not found');
    if (bot.userId !== userId) throw new ForbiddenException();

    return bot;
  }

  async update(id: string, userId: string, dto: UpdateBotDto) {
    await this.findOne(id, userId);

    const { topics, eventSubscriptions, xAccountId, ...botData } = dto;

    // Include xAccountId in the data to update (allow null to unlink)
    const updateData: Record<string, unknown> = { ...botData };
    if (xAccountId !== undefined) {
      updateData.xAccountId = xAccountId || null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (topics !== undefined) {
        await tx.botTopic.deleteMany({ where: { botId: id } });
        if (topics.length) {
          await tx.botTopic.createMany({
            data: topics.map((topic) => ({ botId: id, topic })),
          });
        }
      }

      if (eventSubscriptions !== undefined) {
        await tx.botEventSubscription.deleteMany({ where: { botId: id } });
        if (eventSubscriptions.length) {
          await tx.botEventSubscription.createMany({
            data: eventSubscriptions.map((es) => ({
              botId: id,
              source: es.source,
              category: es.category,
            })),
          });
        }
      }

      const updated = await tx.bot.update({
        where: { id },
        data: updateData,
        include: { topics: true, eventSubscriptions: true },
      });

      await tx.botActivityLog.create({
        data: {
          botId: id,
          action: 'bot_updated',
          metadata: { fields: Object.keys(dto) },
        },
      });

      return updated;
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.bot.delete({ where: { id } });
    return { deleted: true };
  }

  async start(id: string, userId: string) {
    const bot = await this.findOne(id, userId);

    if (bot.isActive) {
      throw new BadRequestException('Bot is already active');
    }

    const updated = await this.prisma.bot.update({
      where: { id },
      data: { isActive: true },
      include: { topics: true, eventSubscriptions: true },
    });

    await this.logActivity(id, 'bot_started');

    return updated;
  }

  async stop(id: string, userId: string) {
    const bot = await this.findOne(id, userId);

    if (!bot.isActive) {
      throw new BadRequestException('Bot is already stopped');
    }

    const updated = await this.prisma.bot.update({
      where: { id },
      data: { isActive: false },
      include: { topics: true, eventSubscriptions: true },
    });

    await this.logActivity(id, 'bot_stopped');

    return updated;
  }

  async getActivityLog(id: string, userId: string, limit = 50) {
    await this.findOne(id, userId);

    return this.prisma.botActivityLog.findMany({
      where: { botId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async logActivity(
    botId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.botActivityLog.create({
      data: {
        botId,
        action,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  }
}
