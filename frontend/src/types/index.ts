// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

export interface Bot {
  id: string;
  userId: string;
  xAccountId: string | null;
  name: string;
  persona: string | null;
  tone: string;
  language: string;
  postingFrequency: number;
  scheduleStartHour: number;
  scheduleEndHour: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  topics: BotTopic[];
  eventSubscriptions: BotEventSubscription[];
  xAccount: XAccount | null;
}

export interface BotTopic {
  id: string;
  botId: string;
  topic: string;
  createdAt: string;
}

export interface BotEventSubscription {
  id: string;
  botId: string;
  source: string;
  category: string;
  createdAt: string;
}

export interface CreateBotPayload {
  name: string;
  persona?: string;
  tone?: string;
  language?: string;
  postingFrequency?: number;
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  xAccountId?: string;
  topics?: string[];
  eventSubscriptions?: { source: string; category: string }[];
}

export type UpdateBotPayload = Partial<CreateBotPayload>;

export interface BotActivityLog {
  id: string;
  botId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─── XAccount ────────────────────────────────────────────────────────────────

export interface XAccount {
  id: string;
  userId: string;
  xUserId: string;
  xUsername: string;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface XAccountWithCount extends XAccount {
  _count: { bots: number };
}

// ─── Tweet ───────────────────────────────────────────────────────────────────

export type TweetStatus = "draft" | "approved" | "scheduled" | "posted" | "failed";

export interface Tweet {
  id: string;
  botId: string;
  eventId: string | null;
  content: string;
  status: TweetStatus;
  xTweetId: string | null;
  postedAt: string | null;
  errorMessage: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  createdAt: string;
  updatedAt: string;
  bot?: Bot;
  event?: Event | null;
  scheduledTweet?: ScheduledTweet | null;
}

export interface ScheduledTweet {
  id: string;
  tweetId: string;
  scheduledFor: string;
  jobId: string | null;
  status: string;
  attempts: number;
  lastAttemptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  source: string;
  category: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  externalId: string | null;
  occurredAt: string;
  ingestedAt: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface BotAnalyticsSummary {
  totalTweets: number;
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
  avgImpressions: number;
  avgLikes: number;
  avgRetweets: number;
  tweetsByStatus: Record<TweetStatus, number>;
}

export interface BotActivity {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  statusCode: number;
  message?: string;
}
