/**
 * Normalized event shape that all source adapters must produce.
 */
export interface NormalizedEvent {
  source: string;
  category: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  externalId: string;
  occurredAt: Date;
}

/**
 * Interface for event source adapters (news, crypto, sports, etc.).
 * Each adapter fetches and normalizes events from an external API.
 */
export interface EventSourceAdapter {
  readonly source: string;
  fetchEvents(): Promise<NormalizedEvent[]>;
}
