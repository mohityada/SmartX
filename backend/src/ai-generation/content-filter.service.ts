import { Injectable, Logger } from '@nestjs/common';

const BANNED_WORDS = [
  'kill',
  'die',
  'hate speech',
  'racial slur',
  'n-word',
  'f-word',
  'terrorism',
  'self-harm',
  'suicide',
];

const URL_REGEX = /https?:\/\/[^\s]+/gi;
const MENTION_SPAM_THRESHOLD = 5;
const HASHTAG_SPAM_THRESHOLD = 5;

export interface ContentFilterResult {
  passed: boolean;
  reason?: string;
  sanitized?: string;
}

@Injectable()
export class ContentFilterService {
  private readonly logger = new Logger(ContentFilterService.name);

  /**
   * Run all content filters on the generated tweet text.
   * Returns a result indicating whether the content is safe to use.
   */
  filter(content: string): ContentFilterResult {
    const trimmed = content.trim();

    if (!trimmed) {
      return { passed: false, reason: 'Empty content' };
    }

    // Enforce tweet length
    if (trimmed.length > 280) {
      return {
        passed: true,
        sanitized: this.truncateToTweetLength(trimmed),
      };
    }

    // Check for banned/toxic words
    const bannedCheck = this.checkBannedWords(trimmed);
    if (!bannedCheck.passed) return bannedCheck;

    // Check for mention spam
    const mentionCount = (trimmed.match(/@\w+/g) || []).length;
    if (mentionCount > MENTION_SPAM_THRESHOLD) {
      return {
        passed: false,
        reason: `Too many mentions (${mentionCount}). Limit: ${MENTION_SPAM_THRESHOLD}`,
      };
    }

    // Check for hashtag spam
    const hashtagCount = (trimmed.match(/#\w+/g) || []).length;
    if (hashtagCount > HASHTAG_SPAM_THRESHOLD) {
      return {
        passed: false,
        reason: `Too many hashtags (${hashtagCount}). Limit: ${HASHTAG_SPAM_THRESHOLD}`,
      };
    }

    // Strip external URLs (LLMs may hallucinate links)
    const sanitized = trimmed.replace(URL_REGEX, '').replace(/\s{2,}/g, ' ').trim();

    if (!sanitized) {
      return { passed: false, reason: 'Content was only URLs' };
    }

    return { passed: true, sanitized };
  }

  private checkBannedWords(text: string): ContentFilterResult {
    const lower = text.toLowerCase();
    for (const word of BANNED_WORDS) {
      if (lower.includes(word)) {
        this.logger.warn(`Content filtered: contains banned word "${word}"`);
        return { passed: false, reason: `Contains prohibited content` };
      }
    }
    return { passed: true };
  }

  /**
   * Truncate text to 280 chars, breaking at the last word boundary.
   */
  private truncateToTweetLength(text: string): string {
    if (text.length <= 280) return text;

    const truncated = text.slice(0, 280);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 200) {
      return truncated.slice(0, lastSpace) + '…';
    }
    return truncated.slice(0, 279) + '…';
  }
}
