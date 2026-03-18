/**
 * Classifies X API errors into retryable vs non-retryable categories.
 * This determines whether BullMQ should retry the job.
 */

export class NonRetryablePostingError extends Error {
  constructor(
    message: string,
    public readonly tweetId: string,
  ) {
    super(message);
    this.name = 'NonRetryablePostingError';
  }
}

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/**
 * Determine whether an X API error is retryable based on HTTP status codes
 * and known error codes from the Twitter API v2.
 */
export function classifyTwitterError(error: unknown): {
  retryable: boolean;
  message: string;
  retryAfterMs?: number;
} {
  const message =
    error instanceof Error ? error.message : 'Unknown posting error';

  // twitter-api-v2 attaches status codes and error data
  const statusCode = getStatusCode(error);

  if (statusCode) {
    // 429 Too Many Requests — rate limited, retryable after delay
    if (statusCode === 429) {
      const retryAfter = getRetryAfterMs(error);
      return { retryable: true, message: `Rate limited (429)`, retryAfterMs: retryAfter };
    }

    // 5xx Server errors — retryable
    if (statusCode >= 500) {
      return { retryable: true, message: `X API server error (${statusCode})` };
    }

    // 401 Unauthorized — token might be stale but refresh already attempted
    if (statusCode === 401) {
      return { retryable: true, message: 'Unauthorized — token may need refresh' };
    }

    // 403 Forbidden — account suspended, app permission issue — not retryable
    if (statusCode === 403) {
      return { retryable: false, message: `Forbidden (403): ${message}` };
    }

    // 400 Bad Request — malformed tweet — not retryable
    if (statusCode === 400) {
      return { retryable: false, message: `Bad request (400): ${message}` };
    }

    // 409 Conflict — duplicate tweet — not retryable
    if (statusCode === 409) {
      return { retryable: false, message: `Duplicate tweet (409): ${message}` };
    }
  }

  // Check for known duplicate tweet error messages
  if (message.includes('duplicate') || message.includes('You are not allowed to create a Tweet with duplicate content')) {
    return { retryable: false, message: `Duplicate tweet: ${message}` };
  }

  // Network errors — retryable
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('socket hang up')
  ) {
    return { retryable: true, message: `Network error: ${message}` };
  }

  // Default: assume retryable for unknown errors
  return { retryable: true, message };
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    // twitter-api-v2 ApiResponseError
    if ('code' in error && typeof (error as Record<string, unknown>).code === 'number') {
      return (error as Record<string, unknown>).code as number;
    }
    // Fallback: statusCode property
    if ('statusCode' in error && typeof (error as Record<string, unknown>).statusCode === 'number') {
      return (error as Record<string, unknown>).statusCode as number;
    }
    // Fallback: status property
    if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
      return (error as Record<string, unknown>).status as number;
    }
  }
  return undefined;
}

function getRetryAfterMs(error: unknown): number {
  if (error && typeof error === 'object' && 'rateLimit' in error) {
    const rateLimit = (error as Record<string, unknown>).rateLimit;
    if (rateLimit && typeof rateLimit === 'object' && 'reset' in rateLimit) {
      const resetEpoch = (rateLimit as Record<string, unknown>).reset;
      if (typeof resetEpoch === 'number') {
        return Math.max(0, resetEpoch * 1000 - Date.now()) + 1000;
      }
    }
  }
  // Default: wait 15 minutes (standard X rate limit window)
  return 15 * 60 * 1000;
}
