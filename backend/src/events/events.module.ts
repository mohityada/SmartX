import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { IngestionProcessor } from './ingestion.processor';
import { QUEUES } from '../scheduler/queue.constants';
import {
  NewsAdapter,
  CryptoAdapter,
  RssAdapter,
  SportsAdapter,
} from './adapters';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.EVENT_PROCESSING }),
    BullModule.registerQueue({ name: QUEUES.EVENT_INGESTION }),
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    IngestionProcessor,

    // Adapters
    NewsAdapter,
    CryptoAdapter,
    RssAdapter,
    SportsAdapter,

    // Collect all adapters into a single injectable array
    {
      provide: 'EVENT_SOURCE_ADAPTERS',
      useFactory: (
        news: NewsAdapter,
        crypto: CryptoAdapter,
        rss: RssAdapter,
        sports: SportsAdapter,
      ) => [news, crypto, rss, sports],
      inject: [NewsAdapter, CryptoAdapter, RssAdapter, SportsAdapter],
    },
  ],
  exports: [EventsService],
})
export class EventsModule {}
