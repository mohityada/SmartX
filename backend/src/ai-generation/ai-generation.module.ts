import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiGenerationService } from './ai-generation.service';
import { AiGenerationProcessor } from './ai-generation.processor';
import { TweetPromptBuilder } from './prompts/tweet-prompt.builder';
import { ContentFilterService } from './content-filter.service';
import { QUEUES } from '../scheduler/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EVENT_PROCESSING })],
  providers: [
    AiGenerationService,
    AiGenerationProcessor,
    TweetPromptBuilder,
    ContentFilterService,
  ],
  exports: [AiGenerationService],
})
export class AiGenerationModule {}
