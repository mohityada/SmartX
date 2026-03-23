import { Injectable, Logger } from '@nestjs/common';
import { EventSourceAdapter, NormalizedEvent } from './event-source.adapter';

/**
 * Scrapes cricket / IPL data from popular free sources (no API keys needed):
 *
 * 1. Cricbuzz RSS — live scores + top stories
 * 2. ESPNcricinfo RSS — cricket news and match stories
 * 3. Google News RSS — IPL-focused cricket news from India
 * 4. NDTV Sports RSS — cricket news (Feedburner)
 *
 * All sources are public RSS feeds with no rate-limit concerns for a 5-min cron.
 */
@Injectable()
export class SportsAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(SportsAdapter.name);
  readonly source = 'sports';

  private readonly feeds = [
    {
      name: 'cricbuzz_scores',
      url: 'https://www.cricbuzz.com/cb-rss/livescores',
      category: 'cricket_live',
    },
    {
      name: 'cricbuzz_stories',
      url: 'https://www.cricbuzz.com/cb-rss/top-stories',
      category: 'cricket_news',
    },
    {
      name: 'espncricinfo',
      url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
      category: 'cricket_news',
    },
    {
      name: 'google_ipl',
      url: 'https://news.google.com/rss/search?q=IPL+cricket+2026&hl=en-IN&gl=IN&ceid=IN:en',
      category: 'ipl',
    },
    {
      name: 'ndtv_cricket',
      url: 'https://feeds.feedburner.com/ndtvsports-cricket',
      category: 'cricket_news',
    },
  ];

  async fetchEvents(): Promise<NormalizedEvent[]> {
    const settled = await Promise.allSettled(
      this.feeds.map((feed) => this.fetchRssFeed(feed)),
    );

    const results: NormalizedEvent[] = [];
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        this.logger.warn(
          `[${this.feeds[i].name}] fetch failed: ${outcome.reason}`,
        );
      }
    }

    // De-duplicate by externalId
    const seen = new Set<string>();
    const unique = results.filter((ev) => {
      if (seen.has(ev.externalId)) return false;
      seen.add(ev.externalId);
      return true;
    });

    this.logger.log(
      `Fetched ${unique.length} cricket events from ${this.feeds.length} feeds`,
    );
    return unique;
  }

  // ── RSS feed parser ─────────────────────────────────────────────────────

  private async fetchRssFeed(feed: {
    name: string;
    url: string;
    category: string;
  }): Promise<NormalizedEvent[]> {
    const response = await fetch(feed.url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'SmartX-Bot/1.0',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      this.logger.warn(`[${feed.name}] returned HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return this.parseRssItems(xml, feed.name, feed.category);
  }

  private parseRssItems(
    xml: string,
    feedName: string,
    category: string,
  ): NormalizedEvent[] {
    const items: NormalizedEvent[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
      const block = match[1];

      const title = this.extractTag(block, 'title');
      if (!title) continue;

      const description =
        this.extractTag(block, 'description') ??
        this.extractTag(block, 'content:encoded');
      const link = this.extractTag(block, 'link');
      const pubDate = this.extractTag(block, 'pubDate');
      const guid = this.extractTag(block, 'guid');

      // Build a stable externalId from guid or link or title
      const rawId = guid ?? link ?? title;
      const externalId = `${feedName}-${this.slugify(rawId)}`;

      // Strip HTML from description
      const cleanDesc = description
        ? description.replace(/<[^>]+>/g, '').trim().slice(0, 2000)
        : undefined;

      items.push({
        source: this.source,
        category,
        title: this.stripHtml(title).slice(0, 500),
        description: cleanDesc || undefined,
        sourceUrl: link?.trim() || undefined,
        externalId,
        occurredAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }

    return items;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private extractTag(xml: string, tag: string): string | null {
    // Handle CDATA-wrapped content
    const cdataRe = new RegExp(
      `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
      'i',
    );
    const cdataMatch = cdataRe.exec(xml);
    if (cdataMatch) return cdataMatch[1].trim();

    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = re.exec(xml);
    return m ? m[1].trim() : null;
  }

  private stripHtml(text: string): string {
    return text.replace(/<[^>]+>/g, '').trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
