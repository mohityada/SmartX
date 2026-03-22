import { Injectable, Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './event-source.adapter';

/**
 * Fetches trending topics from free public sources:
 *
 * 1. Google Trends Daily RSS (no API key needed)
 *    - Endpoint: https://trends.google.com/trends/trendingsearches/daily/rss?geo=US
 *    - Returns top 20 daily trending searches
 *
 * 2. Wikipedia Current Events RSS
 *    - Provides daily notable events summary
 *
 * Both sources are free and have no rate limits for our 5-min cron.
 */
@Injectable()
export class TrendingAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(TrendingAdapter.name);
  readonly source = 'trending';

  async fetchEvents(): Promise<NormalizedEvent[]> {
    const results: NormalizedEvent[] = [];

    const [googleTrends, wikipediaEvents] = await Promise.allSettled([
      this.fetchGoogleTrends(),
      this.fetchWikipediaCurrentEvents(),
    ]);

    if (googleTrends.status === 'fulfilled') {
      results.push(...googleTrends.value);
    } else {
      this.logger.warn(
        `Google Trends fetch failed: ${googleTrends.reason}`,
      );
    }

    if (wikipediaEvents.status === 'fulfilled') {
      results.push(...wikipediaEvents.value);
    } else {
      this.logger.warn(
        `Wikipedia events fetch failed: ${wikipediaEvents.reason}`,
      );
    }

    this.logger.log(`Fetched ${results.length} trending events`);
    return results;
  }

  private async fetchGoogleTrends(): Promise<NormalizedEvent[]> {
    const url =
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US';

    const response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'SmartX-Bot/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn(`Google Trends RSS returned ${response.status}`);
      return [];
    }

    const xml = await response.text();

    const items: NormalizedEvent[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const title = this.extractTag(itemXml, 'title');
      const description = this.extractTag(itemXml, 'ht:news_item_title') ||
        this.extractTag(itemXml, 'description');
      const link = this.extractTag(itemXml, 'link');
      const pubDate = this.extractTag(itemXml, 'pubDate');
      const traffic = this.extractTag(itemXml, 'ht:approx_traffic');

      if (!title) continue;

      items.push({
        source: this.source,
        category: 'google_trends',
        title: title.trim(),
        description: [description, traffic ? `(${traffic} searches)` : '']
          .filter(Boolean)
          .join(' ')
          .trim() || undefined,
        sourceUrl: link?.trim() || undefined,
        externalId: `gtrends-${this.slugify(title)}-${new Date().toISOString().slice(0, 10)}`,
        occurredAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }

    return items.slice(0, 20);
  }

  private async fetchWikipediaCurrentEvents(): Promise<NormalizedEvent[]> {
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    const day = today.getUTCDate();

    const url = `https://en.wikipedia.org/api/rest_v1/page/html/Portal:Current_events`;

    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'SmartX-Bot/1.0 (contact: support@smartx.app)',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn(`Wikipedia events returned ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Extract list items from the current events page
    const items: NormalizedEvent[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = liRegex.exec(html)) !== null && count < 15) {
      const raw = match[1];
      // Strip HTML tags
      const text = raw.replace(/<[^>]+>/g, '').trim();
      if (text.length < 20 || text.length > 500) continue;

      // Extract first link as sourceUrl
      const linkMatch = raw.match(/href="(https?:\/\/[^"]+)"/);

      items.push({
        source: this.source,
        category: 'world_events',
        title:
          text.length > 150 ? text.slice(0, 147) + '...' : text,
        description: text.length > 150 ? text : undefined,
        sourceUrl: linkMatch?.[1],
        externalId: `wiki-${year}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(day).padStart(2, '0')}-${count}`,
        occurredAt: new Date(`${month} ${day}, ${year}`),
      });
      count++;
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    );
    const m = xml.match(regex);
    return m ? (m[1] ?? m[2] ?? null) : null;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
