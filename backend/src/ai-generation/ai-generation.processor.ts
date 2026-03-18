import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiGenerationService } from './ai-generation.service';
import { QUEUES, WORKER_CONCURRENCY } from '../scheduler/queue.constants';

interface GenerateTweetJobData {
  eventId: string;
  botId: string;
}

@Processor(QUEUES.EVENT_PROCESSING, {
  concurrency: WORKER_CONCURRENCY[QUEUES.EVENT_PROCESSING],
})
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(private readonly aiService: AiGenerationService) {
    super();
  }

  async process(job: Job<GenerateTweetJobData>): Promise<string> {
    this.logger.log(
      `Processing job ${job.id}: bot=${job.data.botId}, event=${job.data.eventId}`,
    );

    return this.aiService.generateTweet(job.data.botId, job.data.eventId);
  }
}
