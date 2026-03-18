# Phase 2 — Database Schema Design

## AI Twitter (X) Bot Builder Platform

---

## 1. Entity Relationship Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    users      │───1:N─│    bots       │───1:N─│   bot_topics      │
└──────┬───────┘       └──────┬───────┘       └──────────────────┘
       │                      │
       │ 1:N                  │ 1:N
       ▼                      ▼
┌──────────────┐       ┌──────────────────┐
│  x_accounts   │       │ bot_event_subs    │
└──────────────┘       └───────┬──────────┘
                               │ N:1
                               ▼
                        ┌──────────────┐       ┌──────────────────┐
                        │   events      │───1:N─│    tweets          │
                        └──────────────┘       └───────┬──────────┘
                                                       │
                                                       │ 1:1 (optional)
                                                       ▼
                                               ┌──────────────────┐
                                               │ scheduled_tweets   │
                                               └──────────────────┘

┌──────────────┐       ┌──────────────────┐
│subscriptions  │───N:1─│subscription_plans │
└──────────────┘       └──────────────────┘

┌────────────────────┐
│ bot_activity_logs   │
└────────────────────┘
```

---

## 2. Table Definitions

### 2.1 users
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| avatar_url | TEXT | NULL |
| email_verified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.2 x_accounts
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| x_user_id | VARCHAR(100) | UNIQUE, NOT NULL |
| x_username | VARCHAR(100) | NOT NULL |
| access_token_enc | TEXT | NOT NULL (encrypted) |
| refresh_token_enc | TEXT | NOT NULL (encrypted) |
| token_expires_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.3 subscription_plans
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(50) | UNIQUE, NOT NULL |
| max_bots | INTEGER | NOT NULL |
| max_tweets_per_day | INTEGER | NOT NULL |
| price_cents | INTEGER | NOT NULL |
| stripe_price_id | VARCHAR(255) | NULL |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 2.4 subscriptions
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, UNIQUE, NOT NULL |
| plan_id | UUID | FK → subscription_plans.id, NOT NULL |
| stripe_subscription_id | VARCHAR(255) | NULL |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('active','past_due','canceled','trialing')) |
| current_period_start | TIMESTAMPTZ | NOT NULL |
| current_period_end | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.5 bots
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| x_account_id | UUID | FK → x_accounts.id, NULL |
| name | VARCHAR(100) | NOT NULL |
| persona | TEXT | NULL (LLM system prompt / personality) |
| tone | VARCHAR(50) | DEFAULT 'neutral' |
| language | VARCHAR(10) | DEFAULT 'en' |
| posting_frequency | INTEGER | NOT NULL, DEFAULT 4 (tweets per day) |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.6 bot_topics
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| bot_id | UUID | FK → bots.id ON DELETE CASCADE, NOT NULL |
| topic | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(bot_id, topic) |

### 2.7 events
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| source | VARCHAR(50) | NOT NULL (e.g. 'newsapi', 'coingecko', 'espn') |
| category | VARCHAR(50) | NOT NULL (e.g. 'sports', 'crypto', 'politics') |
| title | VARCHAR(500) | NOT NULL |
| description | TEXT | NULL |
| source_url | TEXT | NULL |
| external_id | VARCHAR(255) | NULL |
| occurred_at | TIMESTAMPTZ | NOT NULL |
| ingested_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(source, external_id) |

### 2.8 bot_event_subscriptions
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| bot_id | UUID | FK → bots.id ON DELETE CASCADE, NOT NULL |
| source | VARCHAR(50) | NOT NULL |
| category | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(bot_id, source, category) |

### 2.9 tweets
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| bot_id | UUID | FK → bots.id ON DELETE CASCADE, NOT NULL |
| event_id | UUID | FK → events.id, NULL |
| content | VARCHAR(280) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('draft','approved','scheduled','posted','failed')) |
| x_tweet_id | VARCHAR(100) | NULL (populated after posting) |
| posted_at | TIMESTAMPTZ | NULL |
| error_message | TEXT | NULL |
| impressions | INTEGER | DEFAULT 0 |
| likes | INTEGER | DEFAULT 0 |
| retweets | INTEGER | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.10 scheduled_tweets
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tweet_id | UUID | FK → tweets.id, UNIQUE, NOT NULL |
| scheduled_for | TIMESTAMPTZ | NOT NULL |
| job_id | VARCHAR(255) | NULL (BullMQ job reference) |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('pending','processing','completed','failed')) |
| attempts | INTEGER | DEFAULT 0 |
| last_attempted_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.11 bot_activity_logs
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| bot_id | UUID | FK → bots.id ON DELETE CASCADE, NOT NULL |
| action | VARCHAR(50) | NOT NULL (e.g. 'tweet_generated', 'tweet_posted', 'tweet_failed', 'event_matched') |
| metadata | JSONB | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

---

## 3. Indexes

| Table | Index | Purpose |
|---|---|---|
| users | `UNIQUE(email)` | Auth lookups |
| x_accounts | `idx_x_accounts_user_id` ON (user_id) | User's linked accounts |
| x_accounts | `UNIQUE(x_user_id)` | Prevent duplicate X account links |
| bots | `idx_bots_user_id` ON (user_id) | User's bots listing |
| bots | `idx_bots_is_active` ON (is_active) WHERE is_active = true | Active bot queries |
| bot_topics | `UNIQUE(bot_id, topic)` | Prevent duplicate topics |
| bot_event_subscriptions | `UNIQUE(bot_id, source, category)` | Prevent duplicate subs |
| bot_event_subscriptions | `idx_bot_event_subs_source_cat` ON (source, category) | Match events to bots |
| events | `UNIQUE(source, external_id)` | Deduplication |
| events | `idx_events_category_occurred` ON (category, occurred_at DESC) | Event queries by category |
| events | `idx_events_ingested_at` ON (ingested_at DESC) | Recent events |
| tweets | `idx_tweets_bot_id_status` ON (bot_id, status) | Bot tweet status queries |
| tweets | `idx_tweets_posted_at` ON (posted_at DESC) WHERE posted_at IS NOT NULL | Posted tweet queries |
| scheduled_tweets | `idx_sched_tweets_scheduled_for` ON (scheduled_for) WHERE status = 'pending' | Scheduler pickup |
| bot_activity_logs | `idx_activity_bot_created` ON (bot_id, created_at DESC) | Activity feed |
| subscriptions | `UNIQUE(user_id)` | One active subscription per user |

---

## 4. Schema Decisions

### UUIDs as Primary Keys
UUIDs prevent enumeration attacks and are safe for distributed systems. They're generated client-side or via `gen_random_uuid()`, avoiding sequential ID leakage.

### Encrypted OAuth Tokens
`access_token_enc` and `refresh_token_enc` are stored encrypted (AES-256-GCM at the application layer). The database never holds plaintext OAuth tokens — this is a critical security requirement.

### Normalized Event System
Events are decoupled from bots. A single event can trigger tweets across multiple bots via `bot_event_subscriptions`. This fan-out pattern scales well and avoids data duplication.

### Separated `scheduled_tweets` Table
Scheduling metadata (job IDs, retry counts, scheduling timestamps) is separated from the core `tweets` table to keep tweet records clean and allow the scheduler to manage its own lifecycle independently.

### Status Enums as CHECK Constraints
Using VARCHAR + CHECK constraints instead of PostgreSQL ENUMs because ENUMs are difficult to alter in migrations. The CHECK constraint achieves the same validation without migration pain.

### JSONB for Activity Log Metadata
`bot_activity_logs.metadata` uses JSONB to flexibly store action-specific data (e.g., error details, tweet IDs, event titles) without requiring schema changes for each new action type.

### Subscription Model
One subscription per user (`UNIQUE(user_id)`). Plan limits (`max_bots`, `max_tweets_per_day`) are enforced at the application layer by checking against the user's active plan.

### Soft Cascading
`ON DELETE CASCADE` is used on child tables of `bots` (topics, subscriptions, tweets, logs) because deleting a bot should clean up all related data. For `users`, deletion should be handled by the application layer with proper cleanup sequencing.

### Timestamptz Everywhere
All timestamps use `TIMESTAMPTZ` (timestamp with time zone) to avoid timezone ambiguity. The application stores everything in UTC.
