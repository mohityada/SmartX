import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PostingService } from './posting.service';
import { PostingProcessor } from './posting.processor';
import { XApiClientService } from './x-api-client.service';
import { TokenCryptoService } from './token-crypto.service';
import { PostingRateLimiter } from './posting-rate-limiter.service';
import { QUEUES } from '../scheduler/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.TWEET_POSTING })],
  providers: [
    PostingService,
    PostingProcessor,
    XApiClientService,
    TokenCryptoService,
    PostingRateLimiter,
  ],
  exports: [PostingService, PostingRateLimiter],
})
export class PostingModule {}
