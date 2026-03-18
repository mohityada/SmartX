import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventSourceAdapter, NormalizedEvent } from './event-source.adapter';

interface SportsDbEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string;
  strThumb: string | null;
  strDescriptionEN: string | null;
}

interface SportsDbResponse {
  events: SportsDbEvent[] | null;
}

/**
 * Fetches recent sports match results from TheSportsDB free API.
 *
 * Free tier (v1 with key "1") provides:
 *  - Last 15 events by league ID (no auth needed, key = "1")
 *
 * Configure SPORTS_LEAGUE_IDS as a comma-separated list of league IDs, e.g.:
 *   SPORTS_LEAGUE_IDS="4328,4346"  (English Premier League, American MLS)
 *
 * See https://www.thesportsdb.com/free_sports_api for league IDs.
 */
@Injectable()
export class SportsAdapter implements EventSourceAdapter {
  private readonly logger = new Logger(SportsAdapter.name);
  readonly source = 'sports';

  private readonly leagueIds: string[];
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('SPORTS_LEAGUE_IDS') ?? '';
    this.leagueIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    this.baseUrl =
      this.configService.get<string>('SPORTSDB_API_URL') ??
      'https://www.thesportsdb.com/api/v1/json/1';
  }

  async fetchEvents(): Promise<NormalizedEvent[]> {
    if (!this.leagueIds.length) {
      this.logger.debug('No SPORTS_LEAGUE_IDS configured — skipping');
      return [];
    }

    const results: NormalizedEvent[] = [];

    for (const leagueId of this.leagueIds) {
      try {
        const events = await this.fetchLeagueEvents(leagueId);
        results.push(...events);
      } catch (error) {
        this.logger.error(
          `Failed to fetch sports events for league ${leagueId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Fetched ${results.length} sports events from ${this.leagueIds.length} leagues`,
    );
    return results;
  }

  private async fetchLeagueEvents(
    leagueId: string,
  ): Promise<NormalizedEvent[]> {
    const url = `${this.baseUrl}/eventspastleague.php?id=${encodeURIComponent(leagueId)}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn(
        `TheSportsDB returned ${response.status} for league ${leagueId}`,
      );
      return [];
    }

    const data: SportsDbResponse = await response.json();

    if (!data.events) return [];

    return data.events.map((ev) => {
      const hasScore = ev.intHomeScore !== null && ev.intAwayScore !== null;
      const scoreText = hasScore
        ? ` — Final: ${ev.strHomeTeam} ${ev.intHomeScore} - ${ev.intAwayScore} ${ev.strAwayTeam}`
        : '';

      return {
        source: this.source,
        category: ev.strSport.toLowerCase(),
        title: `${ev.strEvent}${scoreText}`.slice(0, 500),
        description:
          ev.strDescriptionEN?.slice(0, 2000) ??
          `${ev.strLeague}: ${ev.strHomeTeam} vs ${ev.strAwayTeam}`,
        sourceUrl: ev.strThumb ?? undefined,
        externalId: `sportsdb-${ev.idEvent}`,
        occurredAt: new Date(`${ev.dateEvent}T${ev.strTime || '00:00:00'}Z`),
      };
    });
  }
}
