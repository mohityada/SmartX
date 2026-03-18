import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventSourceAdapter,
  NormalizedEvent,
} from './event-source.adapter';

interface CoinGeckoTrending {
  coins: Array<{
    item: {
      id: string;
      name: string;
      symbol: string;
      market_cap_rank: number;
      data?: {
        price_change_percentage_24h?: Record<string, number>;
      };
    };
  }>;
}

/**
 * Fetches trending cryptocurrency data from CoinGecko's free API.
 * No API key required for the /search/trending endpoint.
 *
 * Rate-limited to ~30 calls/min on the free tier — our 5-min cron is well within limits.
 */
@Injectable()
export class CryptoAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(CryptoAdapter.name);
  readonly source = 'crypto';

  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('COINGECKO_API_URL') ??
      'https://api.coingecko.com/api/v3';
  }

  async fetchEvents(): Promise<NormalizedEvent[]> {
    this.logger.log('Fetching trending crypto from CoinGecko');

    try {
      const response = await fetch(`${this.baseUrl}/search/trending`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`CoinGecko returned ${response.status}`);
        return [];
      }

      const data: CoinGeckoTrending = await response.json();

      return data.coins.map((coin) => {
        const { item } = coin;
        const change24h =
          item.data?.price_change_percentage_24h?.['usd'];
        const description = change24h !== undefined
          ? `${item.name} (${item.symbol.toUpperCase()}) is trending. 24h change: ${change24h.toFixed(2)}%. Market cap rank: #${item.market_cap_rank}`
          : `${item.name} (${item.symbol.toUpperCase()}) is trending on CoinGecko. Market cap rank: #${item.market_cap_rank}`;

        return {
          source: this.source,
          category: 'trending',
          title: `${item.name} (${item.symbol.toUpperCase()}) is trending`,
          description,
          sourceUrl: `https://www.coingecko.com/en/coins/${item.id}`,
          externalId: `trending-${item.id}-${new Date().toISOString().slice(0, 13)}`,
          occurredAt: new Date(),
        };
      });
    } catch (error) {
      this.logger.error(
        'Failed to fetch CoinGecko trending data',
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }
}
