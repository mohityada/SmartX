import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma';
import {
  TweetPromptBuilder,
  PromptParams,
  BatchEvent,
} from './prompts/tweet-prompt.builder';
import { ContentFilterService } from './content-filter.service';

const MAX_GENERATION_RETRIES = 3;
const RECENT_TWEETS_LOOKBACK = 50;
const SIMILARITY_THRESHOLD = 0.6;

/**
 * How far back (in hours) to look for events that already produced tweets
 * for this bot. If the new event's title is too similar to one that already
 * generated a tweet, we skip generation entirely rather than wasting an LLM call.
 */
const EVENT_DEDUP_WINDOW_HOURS = 48;
const EVENT_TITLE_SIMILARITY_THRESHOLD = 0.35;

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

    // Cross-event dedup: check if this bot already tweeted about a similar event
    // (different source, same story). Avoids wasting LLM calls.
    const eventCutoff = new Date(
      Date.now() - EVENT_DEDUP_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const recentBotTweetsWithEvents = await this.prisma.tweet.findMany({
      where: {
        botId,
        eventId: { not: null },
        createdAt: { gte: eventCutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { event: { select: { id: true, title: true } } },
    });

    const eventTitleBigrams = this.getBigrams(event.title);
    for (const tw of recentBotTweetsWithEvents) {
      if (!tw.event) continue;
      const sim = this.jaccardSimilarity(
        eventTitleBigrams,
        this.getBigrams(tw.event.title),
      );
      if (sim >= EVENT_TITLE_SIMILARITY_THRESHOLD) {
        this.logger.warn(
          `Skipping tweet gen for bot ${botId}: event "${event.title.slice(0, 60)}…" ` +
            `too similar to already-tweeted event ${tw.event.id} (sim=${sim.toFixed(2)})`,
        );
        return 'skipped-duplicate-event';
      }
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
      if (
        this.isTooSimilar(
          candidate,
          recentTweets.map((t) => t.content),
        )
      ) {
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
   * Generate tweets for multiple events in a single Claude API call.
   * Saves cost by sending system prompt + recent tweets context only once.
   *
   * Falls back to single-event generation for events that fail in batch.
   */
  async generateTweetsBatch(
    botId: string,
    eventIds: string[],
  ): Promise<string[]> {
    // For single event, use the standard path
    if (eventIds.length === 1) {
      const id = await this.generateTweet(botId, eventIds[0]);
      return [id];
    }

    const bot = await this.prisma.bot.findUniqueOrThrow({
      where: { id: botId },
      include: { topics: true },
    });

    // Load all events
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
    });

    // Filter: skip events that already have tweets or are similar to existing ones
    const eventCutoff = new Date(
      Date.now() - EVENT_DEDUP_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const recentBotTweetsWithEvents = await this.prisma.tweet.findMany({
      where: {
        botId,
        eventId: { not: null },
        createdAt: { gte: eventCutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { eventId: true, event: { select: { id: true, title: true } } },
    });

    const tweetedEventIds = new Set(
      recentBotTweetsWithEvents.map((t) => t.eventId).filter(Boolean),
    );

    const eligibleEvents = events.filter((event) => {
      // Already has a tweet for this exact event
      if (tweetedEventIds.has(event.id)) return false;

      // Similar to an already-tweeted event
      const titleBigrams = this.getBigrams(event.title);
      for (const tw of recentBotTweetsWithEvents) {
        if (!tw.event) continue;
        const sim = this.jaccardSimilarity(
          titleBigrams,
          this.getBigrams(tw.event.title),
        );
        if (sim >= EVENT_TITLE_SIMILARITY_THRESHOLD) {
          this.logger.debug(
            `Batch: skipping event "${event.title.slice(0, 50)}…" — similar to already-tweeted event`,
          );
          return false;
        }
      }
      return true;
    });

    if (!eligibleEvents.length) {
      this.logger.log(`Batch: all ${eventIds.length} events skipped (dedup) for bot ${botId}`);
      return [];
    }

    // Fetch recent tweets for context
    const recentTweets = await this.prisma.tweet.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_TWEETS_LOOKBACK,
      select: { content: true },
    });

    // Build batch prompt
    const batchEvents: BatchEvent[] = eligibleEvents.map((ev, i) => ({
      index: i + 1,
      title: ev.title,
      description: ev.description,
    }));

    const systemPrompt = this.promptBuilder.buildBatchSystemPrompt({
      persona: bot.persona,
      tone: bot.tone,
      topics: bot.topics.map((t) => t.topic),
      recentTweets: recentTweets.map((t) => t.content),
      language: bot.language,
    });

    const userPrompt = this.promptBuilder.buildBatchUserPrompt(
      batchEvents,
      recentTweets.map((t) => t.content),
    );

    // Single Claude API call for all events
    const client = this.getClient();
    const model = this.configService.get<string>('claude.model')!;
    const temperature = this.configService.get<number>('claude.temperature')!;
    // Scale max_tokens: ~80 tokens per tweet
    const maxTokens = Math.min(
      eligibleEvents.length * 80 + 100,
      this.configService.get<number>('claude.maxTokens')! * 2,
    );

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Parse numbered responses: "1. tweet text\n2. tweet text\n..."
    const tweetTexts = this.parseBatchResponse(rawText, eligibleEvents.length);

    // Create tweet records
    const createdIds: string[] = [];
    const recentContents = recentTweets.map((t) => t.content);

    for (let i = 0; i < eligibleEvents.length; i++) {
      const event = eligibleEvents[i];
      const raw = tweetTexts[i];

      if (!raw) {
        this.logger.warn(`Batch: no tweet generated for event ${event.id} (index ${i + 1})`);
        continue;
      }

      const cleaned = this.cleanTweetText(raw);

      // Content filter
      const filterResult = this.contentFilter.filter(cleaned);
      if (!filterResult.passed) {
        this.logger.warn(`Batch: tweet ${i + 1} filtered — ${filterResult.reason}`);
        continue;
      }

      const content = (filterResult.sanitized ?? cleaned).slice(0, 280);

      // Similarity check
      if (this.isTooSimilar(content, recentContents)) {
        this.logger.warn(`Batch: tweet ${i + 1} too similar to recent tweets`);
        continue;
      }

      const tweet = await this.prisma.tweet.create({
        data: {
          botId,
          eventId: event.id,
          content,
          status: 'draft',
        },
      });

      await this.prisma.botActivityLog.create({
        data: {
          botId,
          action: 'tweet_generated',
          metadata: { tweetId: tweet.id, eventId: event.id, batch: true },
        },
      });

      createdIds.push(tweet.id);
      recentContents.push(content); // Add to running dedup list
    }

    this.logger.log(
      `Batch: generated ${createdIds.length}/${eligibleEvents.length} tweets for bot ${botId} in 1 API call`,
    );
    return createdIds;
  }

  /**
   * Parse the numbered batch response from Claude.
   * Expected format: "1. tweet text\n2. tweet text\n..."
   */
  private parseBatchResponse(
    raw: string,
    expectedCount: number,
  ): (string | null)[] {
    const results: (string | null)[] = new Array(expectedCount).fill(null);

    // Match lines like "1. tweet text" or "1) tweet text"
    const lineRegex = /^(\d+)[.)]\s*(.+)/gm;
    let match: RegExpExecArray | null;

    while ((match = lineRegex.exec(raw)) !== null) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < expectedCount) {
        results[idx] = match[2].trim();
      }
    }

    return results;
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
      const similarity = this.jaccardSimilarity(
        candidateBigrams,
        recentBigrams,
      );
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
