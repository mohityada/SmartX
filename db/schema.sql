-- =============================================================================
-- AI Twitter (X) Bot Builder Platform — Database Schema
-- Phase 2: Production-ready PostgreSQL schema
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. USERS
-- =============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

-- =============================================================================
-- 2. X (TWITTER) ACCOUNTS
-- =============================================================================
CREATE TABLE x_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    x_user_id           VARCHAR(100) NOT NULL,
    x_username          VARCHAR(100) NOT NULL,
    access_token_enc    TEXT NOT NULL,
    refresh_token_enc   TEXT NOT NULL,
    token_expires_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_x_accounts_x_user_id UNIQUE (x_user_id)
);

CREATE INDEX idx_x_accounts_user_id ON x_accounts(user_id);

-- =============================================================================
-- 3. SUBSCRIPTION PLANS
-- =============================================================================
CREATE TABLE subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(50) NOT NULL,
    max_bots            INTEGER NOT NULL,
    max_tweets_per_day  INTEGER NOT NULL,
    price_cents         INTEGER NOT NULL,
    stripe_price_id     VARCHAR(255),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_subscription_plans_name UNIQUE (name)
);

-- =============================================================================
-- 4. SUBSCRIPTIONS
-- =============================================================================
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id  VARCHAR(255),
    status                  VARCHAR(20) NOT NULL,
    current_period_start    TIMESTAMPTZ NOT NULL,
    current_period_end      TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_subscriptions_user_id UNIQUE (user_id),
    CONSTRAINT chk_subscriptions_status CHECK (status IN ('active', 'past_due', 'canceled', 'trialing'))
);

-- =============================================================================
-- 5. BOTS
-- =============================================================================
CREATE TABLE bots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    x_account_id        UUID REFERENCES x_accounts(id) ON DELETE SET NULL,
    name                VARCHAR(100) NOT NULL,
    persona             TEXT,
    tone                VARCHAR(50) NOT NULL DEFAULT 'neutral',
    language            VARCHAR(10) NOT NULL DEFAULT 'en',
    posting_frequency   INTEGER NOT NULL DEFAULT 4,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_bots_is_active ON bots(is_active) WHERE is_active = true;

-- =============================================================================
-- 6. BOT TOPICS
-- =============================================================================
CREATE TABLE bot_topics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id      UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    topic       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_bot_topics_bot_topic UNIQUE (bot_id, topic)
);

-- =============================================================================
-- 7. EVENTS
-- =============================================================================
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          VARCHAR(50) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    source_url      TEXT,
    external_id     VARCHAR(255),
    occurred_at     TIMESTAMPTZ NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_events_source_external_id UNIQUE (source, external_id)
);

CREATE INDEX idx_events_category_occurred ON events(category, occurred_at DESC);
CREATE INDEX idx_events_ingested_at ON events(ingested_at DESC);

-- =============================================================================
-- 8. BOT EVENT SUBSCRIPTIONS
-- =============================================================================
CREATE TABLE bot_event_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id      UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    source      VARCHAR(50) NOT NULL,
    category    VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_bot_event_subs UNIQUE (bot_id, source, category)
);

CREATE INDEX idx_bot_event_subs_source_cat ON bot_event_subscriptions(source, category);

-- =============================================================================
-- 9. TWEETS
-- =============================================================================
CREATE TABLE tweets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    content         VARCHAR(280) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    x_tweet_id      VARCHAR(100),
    posted_at       TIMESTAMPTZ,
    error_message   TEXT,
    impressions     INTEGER NOT NULL DEFAULT 0,
    likes           INTEGER NOT NULL DEFAULT 0,
    retweets        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_tweets_status CHECK (status IN ('draft', 'approved', 'scheduled', 'posted', 'failed'))
);

CREATE INDEX idx_tweets_bot_id_status ON tweets(bot_id, status);
CREATE INDEX idx_tweets_posted_at ON tweets(posted_at DESC) WHERE posted_at IS NOT NULL;

-- =============================================================================
-- 10. SCHEDULED TWEETS
-- =============================================================================
CREATE TABLE scheduled_tweets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id            UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    scheduled_for       TIMESTAMPTZ NOT NULL,
    job_id              VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts            INTEGER NOT NULL DEFAULT 0,
    last_attempted_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_scheduled_tweets_tweet_id UNIQUE (tweet_id),
    CONSTRAINT chk_scheduled_tweets_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_sched_tweets_scheduled_for ON scheduled_tweets(scheduled_for) WHERE status = 'pending';

-- =============================================================================
-- 11. BOT ACTIVITY LOGS
-- =============================================================================
CREATE TABLE bot_activity_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id      UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    action      VARCHAR(50) NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_bot_created ON bot_activity_logs(bot_id, created_at DESC);

-- =============================================================================
-- 12. SEED DEFAULT SUBSCRIPTION PLANS
-- =============================================================================
INSERT INTO subscription_plans (id, name, max_bots, max_tweets_per_day, price_cents, is_active) VALUES
    (gen_random_uuid(), 'free',       1,   5,     0, true),
    (gen_random_uuid(), 'pro',        5,  50,  1999, true),
    (gen_random_uuid(), 'enterprise', 25, 500, 9999, true);

-- =============================================================================
-- 13. HELPER: AUTO-UPDATE updated_at TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users           BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_x_accounts      BEFORE UPDATE ON x_accounts       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_subscriptions   BEFORE UPDATE ON subscriptions    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_bots            BEFORE UPDATE ON bots             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_tweets          BEFORE UPDATE ON tweets           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_scheduled       BEFORE UPDATE ON scheduled_tweets FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
