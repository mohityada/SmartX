import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventSourceAdapter,
  NormalizedEvent,
} from './event-source.adapter';

/**
 * Fetches and parses RSS/Atom feeds configured via RSS_FEED_URLS env var.
 *
 * Set RSS_FEED_URLS to a comma-separated list of feed URLs, e.g.:
 *   RSS_FEED_URLS="https://feeds.bbci.co.uk/news/technology/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"
 *
 * Uses a simple XML regex parser to avoid an external RSS library dependency.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) feed structures.
 */
@Injectable()
export class RssAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(RssAdapter.name);
  readonly source = 'rss';

  private readonly feedUrls: string[];

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('RSS_FEED_URLS') ?? '';
    this.feedUrls = raw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }

  async fetchEvents(): Promise<NormalizedEvent[]> {
    if (!this.feedUrls.length) {
      this.logger.debug('No RSS_FEED_URLS configured — skipping');
      return [];
    }

    const results: NormalizedEvent[] = [];

    for (const feedUrl of this.feedUrls) {
      try {
        const events = await this.parseFeed(feedUrl);
        results.push(...events);
      } catch (error) {
        this.logger.error(
          `Failed to parse RSS feed: ${feedUrl}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(`Parsed ${results.length} items from ${this.feedUrls.length} RSS feeds`);
    return results;
  }

  private async parseFeed(feedUrl: string): Promise<NormalizedEvent[]> {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn(`RSS feed returned ${response.status}: ${feedUrl}`);
      return [];
    }

    const xml = await response.text();
    return this.parseXml(xml, feedUrl);
  }

  private parseXml(xml: string, feedUrl: string): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];

    // Try RSS 2.0 format (<item>)
    const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
    // Try Atom format (<entry>)
    const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];

    const items = rssItems.length ? rssItems : atomEntries;
    const isAtom = rssItems.length === 0 && atomEntries.length > 0;

    for (const item of items.slice(0, 20)) {
      const title = this.extractTag(item, 'title');
      if (!title) continue;

      const link = isAtom
        ? this.extractAtomLink(item)
        : this.extractTag(item, 'link');
      const description =
        this.extractTag(item, 'description') ??
        this.extractTag(item, 'summary') ??
        this.extractTag(item, 'content');
      const pubDate =
        this.extractTag(item, 'pubDate') ??
        this.extractTag(item, 'published') ??
        this.extractTag(item, 'updated');
      const guid =
        this.extractTag(item, 'guid') ??
        this.extractTag(item, 'id') ??
        link;

      if (!guid) continue;

      events.push({
        source: this.source,
        category: this.categorizeFromUrl(feedUrl),
        title: this.stripHtml(title).slice(0, 500),
        description: description
          ? this.stripHtml(description).slice(0, 2000)
          : undefined,
        sourceUrl: link ?? undefined,
        externalId: `rss-${this.simpleHash(guid)}`,
        occurredAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }

    return events;
  }

  private extractTag(xml: string, tag: string): string | null {
    // Handle CDATA: <tag><![CDATA[content]]></tag>
    const cdataRegex = new RegExp(
      `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
      'i',
    );
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1].trim();

    // Handle plain text: <tag>content</tag>
    const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const plainMatch = xml.match(plainRegex);
    if (plainMatch) return plainMatch[1].trim();

    return null;
  }

  private extractAtomLink(entry: string): string | null {
    // <link href="..." /> or <link href="..."></link>
    const match = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
    return match ? match[1] : null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  }

  private categorizeFromUrl(feedUrl: string): string {
    const lower = feedUrl.toLowerCase();
    if (lower.includes('cricket') || lower.includes('ipl') || lower.includes('espncricinfo')) return 'cricket';
    if (lower.includes('sport')) return 'sports';
    if (lower.includes('tech')) return 'technology';
    if (lower.includes('business') || lower.includes('finance')) return 'business';
    if (lower.includes('entertainment')) return 'entertainment';
    if (lower.includes('science')) return 'science';
    return 'general';
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash + chr) | 0;
    }
    return Math.abs(hash).toString(36);
  }
}
