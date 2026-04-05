import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma';
import { CreateBotDto, UpdateBotDto } from './dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

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

    // Auto-subscribe to all available sources if no explicit subscriptions provided
    if (!eventSubscriptions?.length) {
      await this.subscribeToAllSources(bot.id);
      // Re-fetch to include the auto-created subscriptions
      return this.prisma.bot.findUniqueOrThrow({
        where: { id: bot.id },
        include: { topics: true, eventSubscriptions: true },
      });
    }

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

  /**
   * Subscribe a bot to all available event source+category pairs.
   * Skips pairs that are already subscribed.
   */
  async subscribeToAllSources(botId: string): Promise<number> {
    const available = await this.eventsService.getAvailableSources();

    // Get existing subscriptions for this bot
    const existing = await this.prisma.botEventSubscription.findMany({
      where: { botId },
      select: { source: true, category: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.source}:${e.category}`),
    );

    // Filter out already-subscribed pairs
    const toCreate = available.filter(
      (pair) => !existingKeys.has(`${pair.source}:${pair.category}`),
    );

    if (!toCreate.length) {
      this.logger.debug(`Bot ${botId}: already subscribed to all sources`);
      return 0;
    }

    await this.prisma.botEventSubscription.createMany({
      data: toCreate.map((pair) => ({
        botId,
        source: pair.source,
        category: pair.category,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Bot ${botId}: auto-subscribed to ${toCreate.length} source+category pairs`,
    );

    await this.logActivity(botId, 'auto_subscribed', {
      count: toCreate.length,
      pairs: toCreate,
    });

    return toCreate.length;
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
