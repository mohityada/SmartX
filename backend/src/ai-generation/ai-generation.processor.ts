import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiGenerationService } from './ai-generation.service';
import { QUEUES, WORKER_CONCURRENCY } from '../scheduler/queue.constants';

interface GenerateTweetJobData {
  eventId: string;
  botId: string;
}

interface GenerateTweetsBatchJobData {
  botId: string;
  eventIds: string[];
}

@Processor(QUEUES.EVENT_PROCESSING, {
  concurrency: WORKER_CONCURRENCY[QUEUES.EVENT_PROCESSING],
})
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(private readonly aiService: AiGenerationService) {
    super();
  }

  async process(
    job: Job<GenerateTweetJobData | GenerateTweetsBatchJobData>,
  ): Promise<string | string[]> {
    if (job.name === 'generate-tweets-batch') {
      const { botId, eventIds } = job.data as GenerateTweetsBatchJobData;
      this.logger.log(
        `Processing batch job ${job.id}: bot=${botId}, events=${eventIds.length}`,
      );
      return this.aiService.generateTweetsBatch(botId, eventIds);
    }

    // Legacy single-event job support
    const { botId, eventId } = job.data as GenerateTweetJobData;
    this.logger.log(
      `Processing job ${job.id}: bot=${botId}, event=${eventId}`,
    );
    return this.aiService.generateTweet(botId, eventId);
  }
}
