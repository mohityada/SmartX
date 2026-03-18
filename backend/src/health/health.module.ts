import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { HealthController } from './health.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { HEALTH_REDIS } from './health.constants';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        }),
    },
  ],
})
export class HealthModule {}
