import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Redis } from 'ioredis';
import { HEALTH_REDIS } from './health.constants';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(HEALTH_REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const [database, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = database.status === 'up' && redisStatus.status === 'up';
    const allDown = database.status === 'down' && redisStatus.status === 'down';

    return {
      status: allUp ? 'ok' : allDown ? 'down' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database, redis: redisStatus },
    };
  }

  @Get('live')
  live() {
    return { status: 'ok', commitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string }> {
    await this.prisma.$queryRawUnsafe('SELECT 1');
    return { status: 'ok' };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (e) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        status: pong === 'PONG' ? 'up' : 'down',
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}
