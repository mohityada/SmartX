import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventSourceAdapter, NormalizedEvent } from './event-source.adapter';

interface NewsApiArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { id: string | null; name: string };
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

/**
 * Fetches top headlines from NewsAPI.org.
 * Requires a NEWS_API_KEY environment variable.
 * Falls back gracefully when the key is not configured.
 *
 * Free tier: 100 requests/day — our 5-min cron = 288/day, so consider
 * setting EVENTS_NEWS_ENABLED=false or increasing the cron interval
 * in production without a paid plan.
 */
@Injectable()
export class NewsAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(NewsAdapter.name);
  readonly source = 'news';

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('NEWS_API_KEY');
    this.baseUrl =
      this.configService.get<string>('NEWS_API_URL') ??
      'https://newsapi.org/v2';
  }

  async fetchEvents(): Promise<NormalizedEvent[]> {
    if (!this.apiKey) {
      this.logger.debug(
        'NEWS_API_KEY not configured — skipping news ingestion',
      );
      return [];
    }

    this.logger.log('Fetching top headlines from NewsAPI');

    try {
      const url = new URL(`${this.baseUrl}/top-headlines`);
      url.searchParams.set('language', 'en');
      url.searchParams.set('pageSize', '20');
      url.searchParams.set('apiKey', this.apiKey);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`NewsAPI returned ${response.status}`);
        return [];
      }

      const data: NewsApiResponse = await response.json();

      if (data.status !== 'ok') {
        this.logger.warn(`NewsAPI status: ${data.status}`);
        return [];
      }

      return data.articles
        .filter((a) => a.title && a.url)
        .map((article) => ({
          source: this.source,
          category: 'headline',
          title: article.title.slice(0, 500),
          description: article.description?.slice(0, 2000) ?? undefined,
          sourceUrl: article.url,
          externalId: this.hashUrl(article.url),
          occurredAt: new Date(article.publishedAt),
        }));
    } catch (error) {
      this.logger.error(
        'Failed to fetch from NewsAPI',
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  /**
   * Produces a deterministic short hash from a URL for deduplication.
   */
  private hashUrl(url: string): string {
    // Use a simple hash — crypto.createHash is overkill for dedup IDs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const chr = url.charCodeAt(i);
      hash = ((hash << 5) - hash + chr) | 0;
    }
    return `news-${Math.abs(hash).toString(36)}`;
  }
}
