# Phase 1 — Product & Architecture Design

## AI Twitter (X) Bot Builder Platform

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│   Next.js Dashboard (Web)          Mobile (Future)                   │
└──────────────┬──────────────────────────┬────────────────────────────┘
               │  HTTPS / WSS             │
               ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / LOAD BALANCER                      │
│                  (Nginx / AWS ALB / Cloudflare)                      │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NestJS BACKEND SERVICES                         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐          │
│  │ Auth Service  │  │ Bot Service  │  │ Event Ingestion   │          │
│  │ (JWT/OAuth)   │  │              │  │ Service            │          │
│  └──────────────┘  └──────────────┘  └───────────────────┘          │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐          │
│  │ AI Tweet     │  │ Scheduler    │  │ Tweet Posting      │          │
│  │ Generation   │  │ Service      │  │ Service             │          │
│  └──────────────┘  └──────────────┘  └───────────────────┘          │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │ Subscription │  │ Analytics    │                                  │
│  │ Service      │  │ Service      │                                  │
│  └──────────────┘  └──────────────┘                                  │
└───────┬─────────────────┬─────────────────┬─────────────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌───────────────────┐
│  PostgreSQL  │  │    Redis     │  │   BullMQ Queues   │
│  (Primary DB)│  │  (Cache +    │  │  (Job Scheduling) │
│              │  │   Sessions)  │  │                   │
└──────────────┘  └──────────────┘  └───────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL INTEGRATIONS                            │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐          │
│  │ Twitter/X    │  │ OpenAI /     │  │ Event Sources      │          │
│  │ API v2       │  │ Anthropic    │  │ (News, Sports,     │          │
│  │              │  │ (LLM)        │  │  Crypto APIs)      │          │
│  └──────────────┘  └──────────────┘  └───────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Breakdown

### 2.1 Auth Service
| Property | Detail |
|---|---|
| **Responsibility** | User registration, login, JWT token issuance/refresh, OAuth 2.0 flow for X account linking |
| **Tech** | NestJS + Passport.js + `@nestjs/jwt` |
| **Storage** | PostgreSQL (`users`, `x_accounts` tables) |
| **Key Endpoints** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/x/callback` |

### 2.2 Bot Service
| Property | Detail |
|---|---|
| **Responsibility** | CRUD operations for bots, topic configuration, linking bots to X accounts and event sources |
| **Tech** | NestJS module |
| **Storage** | PostgreSQL (`bots`, `bot_topics`, `bot_event_subscriptions`) |
| **Key Endpoints** | `POST /bots`, `GET /bots`, `PATCH /bots/:id`, `DELETE /bots/:id`, `POST /bots/:id/topics` |

### 2.3 Event Ingestion Service
| Property | Detail |
|---|---|
| **Responsibility** | Poll or receive webhooks from external event sources (news APIs, sports APIs, crypto feeds). Normalize events into a standard format. Publish events to the internal queue. |
| **Tech** | NestJS + `@nestjs/schedule` (cron) + BullMQ |
| **Storage** | PostgreSQL (`events`), Redis (deduplication cache) |
| **Integrations** | NewsAPI, CoinGecko, ESPN API, custom RSS feeds |
| **Pattern** | Adapter pattern — one adapter per source type, all produce a normalized `Event` object |

### 2.4 AI Tweet Generation Service
| Property | Detail |
|---|---|
| **Responsibility** | Consume events, generate tweet text using LLM, respect bot persona/tone/topic configuration |
| **Tech** | NestJS + OpenAI SDK (`openai` npm package) |
| **Storage** | PostgreSQL (`tweets` table — stores generated drafts) |
| **Flow** | Event received → fetch bot config → build prompt → call LLM → store draft tweet |
| **Safety** | Content moderation filter before storing, rate limiting per bot |

### 2.5 Scheduler Service
| Property | Detail |
|---|---|
| **Responsibility** | Schedule tweets for future posting, manage posting cadence per bot, enforce rate limits |
| **Tech** | NestJS + BullMQ (delayed jobs) |
| **Storage** | PostgreSQL (`scheduled_tweets`), Redis (BullMQ backing store) |
| **Key Behavior** | Respects per-bot posting frequency, time-zone aware scheduling, retry with exponential backoff |

### 2.6 Tweet Posting Service
| Property | Detail |
|---|---|
| **Responsibility** | Post tweets to X via API, handle OAuth token refresh, record posting results |
| **Tech** | NestJS + `twitter-api-v2` npm package |
| **Storage** | PostgreSQL (update `tweets.status`, `tweets.posted_at`) |
| **Resilience** | Retry on transient failures, circuit breaker for X API outages, dead-letter queue for permanent failures |

### 2.7 Subscription / Billing Service
| Property | Detail |
|---|---|
| **Responsibility** | Manage user subscription tiers (free/pro/enterprise), enforce limits (bots, tweets/day), integrate with payment provider |
| **Tech** | NestJS + Stripe SDK |
| **Storage** | PostgreSQL (`subscriptions`, `subscription_plans`) |
| **Key Behavior** | Webhook listener for Stripe events, plan enforcement middleware |

### 2.8 Analytics Service
| Property | Detail |
|---|---|
| **Responsibility** | Track bot activity, tweet performance (impressions, likes, retweets via X API), event processing metrics |
| **Tech** | NestJS module |
| **Storage** | PostgreSQL (`bot_activity_logs`), optionally time-series DB for heavy analytics |
| **Key Endpoints** | `GET /analytics/bots/:id/summary`, `GET /analytics/tweets/:id/performance` |

---

## 3. Data Flow

### 3.1 Bot Creation Flow
```
User → Dashboard (Next.js)
  → POST /bots (Auth via JWT)
    → Bot Service validates input
      → Creates bot record in PostgreSQL
        → Returns bot config to user
```

### 3.2 X Account Connection Flow
```
User → "Connect X Account" button
  → Redirect to X OAuth 2.0 authorization screen
    → User authorizes
      → X redirects to /auth/x/callback
        → Auth Service exchanges code for access_token + refresh_token
          → Stores encrypted tokens in x_accounts table
            → Links X account to user
```

### 3.3 Event-to-Tweet Pipeline (Core Flow)
```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  External       │     │  Event          │     │  BullMQ         │
│  Event Source   │────▶│  Ingestion      │────▶│  Event Queue    │
│  (News, Crypto) │     │  Service        │     │                 │
└────────────────┘     └────────────────┘     └───────┬─────────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │  AI Tweet       │
                                              │  Generation     │
                                              │  Service        │
                                              └───────┬─────────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │  Scheduler      │
                                              │  Service        │
                                              │  (BullMQ delay) │
                                              └───────┬─────────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │  Tweet Posting  │
                                              │  Service        │
                                              └───────┬─────────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │  Twitter/X      │
                                              │  API v2         │
                                              └────────────────┘
```

**Step-by-step:**
1. **Event Ingestion** polls or listens to external event sources on a cron schedule.
2. Events are normalized and deduped (Redis set check), then stored in PostgreSQL.
3. For each event, the service checks which bots have subscriptions matching the event category/topic.
4. A job is enqueued per matching bot onto the **event queue**.
5. **AI Tweet Generation** consumes the job, loads the bot's persona + topic config, builds an LLM prompt, calls OpenAI, and stores the draft tweet.
6. The **Scheduler** picks up approved tweets and creates delayed BullMQ jobs based on the bot's posting schedule.
7. **Tweet Posting** executes the delayed job — calls X API v2, records the result, and retries on transient errors.

### 3.4 Analytics Flow
```
Tweet Posting completes
  → Log activity to bot_activity_logs
  → Periodic cron job fetches tweet metrics from X API
    → Updates tweet performance data
      → Dashboard queries analytics endpoints
```

---

## 4. Scalable Infrastructure Recommendations

### Compute
| Layer | Recommendation |
|---|---|
| **API Backend** | Containerized NestJS on AWS ECS Fargate or Kubernetes (EKS). Horizontal auto-scaling based on CPU/request metrics. |
| **Workers** | Separate ECS tasks for BullMQ workers (event ingestion, tweet generation, posting). Scale independently from API. |
| **Frontend** | Next.js deployed on Vercel or AWS Amplify for edge caching + SSR. |

### Data
| Component | Recommendation |
|---|---|
| **PostgreSQL** | AWS RDS PostgreSQL (Multi-AZ) or Supabase for managed Postgres. Read replicas for analytics queries. |
| **Redis** | AWS ElastiCache Redis for caching, sessions, and BullMQ job queue backing store. |
| **File Storage** | AWS S3 for any media or export files. |

### Networking & Security
| Concern | Recommendation |
|---|---|
| **API Gateway** | AWS ALB or Cloudflare for rate limiting, DDoS protection. |
| **Secrets** | AWS Secrets Manager or HashiCorp Vault for API keys, OAuth tokens, DB credentials. |
| **HTTPS** | TLS everywhere — enforce HSTS. |
| **OAuth Tokens** | Encrypted at rest (AES-256) in PostgreSQL. |

### Observability
| Area | Tool |
|---|---|
| **Logging** | Structured JSON logs → CloudWatch or Datadog |
| **Metrics** | Prometheus + Grafana or Datadog APM |
| **Alerting** | PagerDuty / Opsgenie for critical failures |
| **Tracing** | OpenTelemetry for distributed request tracing |

### Cost Optimization for MVP
For initial launch, a simpler deployment is viable:
- **Single NestJS monolith** with modular architecture (one process, multiple NestJS modules)
- **Managed Postgres** (Supabase free tier or Railway)
- **Managed Redis** (Upstash serverless Redis)
- **Vercel** for Next.js frontend
- Scale out to separate services when traffic justifies it

---

## 5. Technology Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 15+ |
| Cache / Queue | Redis + BullMQ |
| Auth | Passport.js, JWT, OAuth 2.0 (X) |
| AI/LLM | OpenAI API (gpt-4o) |
| X Integration | `twitter-api-v2` npm package |
| Payments | Stripe |
| Deployment | Docker, AWS ECS / Vercel |
| CI/CD | GitHub Actions |
