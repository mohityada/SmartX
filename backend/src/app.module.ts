import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma';
import {
  appConfig,
  jwtConfig,
  redisConfig,
  claudeConfig,
  twitterConfig,
} from './config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BotsModule } from './bots/bots.module';
import { EventsModule } from './events/events.module';
import { TweetsModule } from './tweets/tweets.module';
import { AiGenerationModule } from './ai-generation/ai-generation.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PostingModule } from './posting/posting.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { XOAuthModule } from './x-oauth/x-oauth.module';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, redisConfig, claudeConfig, twitterConfig],
    }),

    // Cron scheduling
    ScheduleModule.forRoot(),

    // BullMQ (Redis-backed job queues)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    BotsModule,
    EventsModule,
    TweetsModule,
    AiGenerationModule,
    SchedulerModule,
    PostingModule,
    AnalyticsModule,
    HealthModule,
    XOAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
