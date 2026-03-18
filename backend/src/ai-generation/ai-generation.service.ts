import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma';
import { TweetPromptBuilder, PromptParams } from './prompts/tweet-prompt.builder';
import { ContentFilterService } from './content-filter.service';

const MAX_GENERATION_RETRIES = 3;
const RECENT_TWEETS_LOOKBACK = 20;
const SIMILARITY_THRESHOLD = 0.6;

@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly promptBuilder: TweetPromptBuilder,
    private readonly contentFilter: ContentFilterService,
  ) {}

  private getClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = this.configService.get<string>('claude.apiKey');
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not configured. Set it in your environment variables.',
        );
      }
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  /**
   * Generate a tweet for a given bot + event pair.
   * Includes duplicate avoidance via recent-tweet lookback and content filtering.
   */
  async generateTweet(botId: string, eventId: string): Promise<string> {
    const bot = await this.prisma.bot.findUniqueOrThrow({
      where: { id: botId },
      include: { topics: true },
    });

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });

    // Check if a tweet already exists for this bot+event pair
    const existingTweet = await this.prisma.tweet.findFirst({
      where: { botId, eventId },
    });
    if (existingTweet) {
      this.logger.warn(
        `Tweet already exists for bot ${botId} + event ${eventId}: ${existingTweet.id}`,
      );
      return existingTweet.id;
    }

    // Fetch recent tweets to avoid duplication in phrasing
    const recentTweets = await this.prisma.tweet.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_TWEETS_LOOKBACK,
      select: { content: true },
    });

    const promptParams: PromptParams = {
      persona: bot.persona,
      tone: bot.tone,
      topics: bot.topics.map((t) => t.topic),
      eventTitle: event.title,
      eventDescription: event.description,
      recentTweets: recentTweets.map((t) => t.content),
      language: bot.language,
    };

    // Retry loop: generate, filter, and check for duplicates
    let content: string | null = null;
    for (let attempt = 1; attempt <= MAX_GENERATION_RETRIES; attempt++) {
      const raw = await this.callClaude(promptParams);

      // Content filter
      const filterResult = this.contentFilter.filter(raw);
      if (!filterResult.passed) {
        this.logger.warn(
          `Attempt ${attempt}: content filtered — ${filterResult.reason}`,
        );
        continue;
      }

      const candidate = filterResult.sanitized ?? raw;

      // Duplicate check against recent tweets
      if (this.isTooSimilar(candidate, recentTweets.map((t) => t.content))) {
        this.logger.warn(
          `Attempt ${attempt}: generated tweet too similar to a recent tweet`,
        );
        continue;
      }

      content = candidate;
      break;
    }

    if (!content) {
      this.logger.error(
        `Failed to generate acceptable tweet for bot ${botId} + event ${eventId} after ${MAX_GENERATION_RETRIES} attempts`,
      );
      throw new Error(
        `Tweet generation failed after ${MAX_GENERATION_RETRIES} attempts`,
      );
    }

    const tweet = await this.prisma.tweet.create({
      data: {
        botId,
        eventId,
        content: content.slice(0, 280),
        status: 'draft',
      },
    });

    await this.prisma.botActivityLog.create({
      data: {
        botId,
        action: 'tweet_generated',
        metadata: { tweetId: tweet.id, eventId },
      },
    });

    this.logger.log(`Generated tweet ${tweet.id} for bot ${botId}`);
    return tweet.id;
  }

  /**
   * Call Claude via the Anthropic SDK to generate tweet content.
   */
  private async callClaude(params: PromptParams): Promise<string> {
    const client = this.getClient();
    const model = this.configService.get<string>('claude.model')!;
    const maxTokens = this.configService.get<number>('claude.maxTokens')!;
    const temperature = this.configService.get<number>('claude.temperature')!;

    const systemPrompt = this.promptBuilder.buildSystemPrompt(params);
    const userPrompt = this.promptBuilder.buildUserPrompt(params);

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    return this.cleanTweetText(text);
  }

  /**
   * Post-process the raw LLM output: strip quotes, whitespace, etc.
   */
  private cleanTweetText(raw: string): string {
    let text = raw.trim();

    // Remove surrounding quotes if the model wrapped the tweet
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('\u201c') && text.endsWith('\u201d'))
    ) {
      text = text.slice(1, -1).trim();
    }

    // Remove leading "Tweet:" or similar prefixes the model may add
    text = text.replace(/^(tweet:\s*)/i, '').trim();

    return text;
  }

  /**
   * Simple bigram-based similarity check to avoid generating near-duplicate tweets.
   * Returns true if the candidate is too similar to any recent tweet.
   */
  private isTooSimilar(candidate: string, recentTexts: string[]): boolean {
    const candidateBigrams = this.getBigrams(candidate);

    for (const recent of recentTexts) {
      const recentBigrams = this.getBigrams(recent);
      const similarity = this.jaccardSimilarity(candidateBigrams, recentBigrams);
      if (similarity >= SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  private getBigrams(text: string): Set<string> {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
