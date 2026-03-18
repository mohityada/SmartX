# SmartX — AI Twitter (X) Bot Builder Platform

An AI-powered SaaS platform that lets you create, configure, and run Twitter/X bots. Bots automatically monitor topics, pull in events (RSS feeds, sports, crypto, news), generate contextual tweets using Claude AI, and post them on a schedule — all without manual effort.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [X Developer OAuth Setup](#x-developer-oauth-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Overview](#api-overview)
- [Project Structure](#project-structure)

---

## How It Works

```
  RSS / Sports / News APIs
          │
          ▼
  ┌──────────────────┐
  │  Event Ingestion  │   Pulls events matching your bot's topics every 10 min
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  AI Generation   │   Claude generates a tweet draft for each event
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  Tweet Review    │   You approve drafts in the dashboard (or auto-approve)
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   Scheduler      │   Distributes approved tweets across active hours (8am–11pm)
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  Posting Service │   Posts to X via OAuth 2.0 on behalf of linked account
  └──────────────────┘
```

1. **Create a bot** — Give it a name, topics (e.g. "IPL, cricket, Virat Kohli"), and posting frequency.
2. **Link your X account** — Go to Settings → Connect X Account. This uses OAuth 2.0 PKCE flow.
3. **Subscribe to event sources** — RSS feeds, sports leagues, crypto tickers, or news keywords.
4. **Review tweets** — Drafts appear in the Tweets tab. Approve the ones you like.
5. **Auto-post** — The scheduler runs every 10 minutes and posts approved tweets at spread-out intervals.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
│              (Dashboard, Bots, Tweets, Analytics)        │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────┐
│                    NestJS Backend                        │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Auth   │  │  Bots  │  │  Tweets  │  │Analytics │  │
│  └──────────┘  └────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Events  │  │   AI   │  │ Posting  │  │Scheduler │  │
│  └──────────┘  └────────┘  └──────────┘  └──────────┘  │
└──────────┬────────────────────────┬────────────────────-┘
           │                        │
     ┌─────▼─────┐           ┌──────▼──────┐
     │ PostgreSQL │           │    Redis    │
     │  (data)    │           │  (BullMQ)   │
     └────────────┘           └─────────────┘
```

---

## Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend     | NestJS 11, TypeScript, Prisma ORM             |
| Database    | PostgreSQL 16                                 |
| Queue       | BullMQ + Redis 7                              |
| AI          | Anthropic Claude (claude-sonnet-4)            |
| Auth        | JWT (access + refresh tokens), bcrypt         |
| Twitter/X   | OAuth 2.0 PKCE (twitter-api-v2)               |
| Infra       | Docker Compose, Kubernetes manifests, GitHub Actions CI/CD |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Node.js](https://nodejs.org/) v20+ (only needed if running without Docker)
- A free [Anthropic account](https://console.anthropic.com/) for Claude API key
- A [Twitter/X Developer account](https://developer.twitter.com/) for OAuth credentials

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/mohityada/SmartX.git
cd SmartX
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see [Environment Variables](#environment-variables) below).

### 3. Generate secret keys

```bash
# JWT_SECRET — any long random string
openssl rand -base64 32

# TOKEN_ENCRYPTION_KEY — must be exactly 64 hex characters (32 bytes)
openssl rand -hex 32
```

Paste these values into your `.env`:

```env
JWT_SECRET=<output of first command>
TOKEN_ENCRYPTION_KEY=<output of second command>
```

### 4. Start everything with Docker

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5433`
- **Redis** on port `6379`
- **Backend API** on port `3000`
- **Frontend** on port `3001`

### 5. Open the app

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3001        |
| API       | http://localhost:3000/api    |
| API Docs  | http://localhost:3000/api/docs |
| Health    | http://localhost:3000/api/health |

Register a new account at http://localhost:3001/register and you're in.

---

## X Developer OAuth Setup

This is the most important step for actually posting tweets. Follow carefully.

### Step 1 — Create a Developer App

1. Go to [developer.twitter.com](https://developer.twitter.com) and sign in.
2. Click **"Sign up for Free Account"** if you don't have a developer account.
3. In the Developer Portal, click **"+ Add App"** (or go to **Projects & Apps → Overview**).
4. Give your app a name (e.g. `SmartX Local Dev`).

### Step 2 — Enable OAuth 2.0

1. Click on your app → **"User authentication settings"** → **Edit**.
2. Set **App permissions** to **"Read and write"**.
3. Set **Type of App** to **"Web App, Automated App or Bot"**.
4. Set the following URLs:

   | Field                    | Value                                         |
   |--------------------------|-----------------------------------------------|
   | Callback URI / Redirect  | `http://127.0.0.1:3000/api/auth/x/callback`   |
   | Website URL              | `http://127.0.0.1:3001`                       |

   > **Important:** Use `127.0.0.1`, not `localhost`. Twitter rejects `localhost` as a callback URL but allows `127.0.0.1` for local development.

5. Click **Save**.

### Step 3 — Get your Client ID and Secret

1. In your app settings, go to **"Keys and Tokens"**.
2. Under **OAuth 2.0 Client ID and Client Secret**, click **"Generate"** (or **"Regenerate"**).
3. Copy both values immediately — the secret is only shown once.

### Step 4 — Add credentials to your `.env`

```env
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here
```

### Step 5 — Rebuild and restart the backend

```bash
docker compose build backend && docker compose up -d --force-recreate backend
```

### Step 6 — Connect your X account in the app

1. Open http://localhost:3001 and log in.
2. Go to **Settings → X Accounts** → click **"Connect X Account"**.
3. You'll be redirected to Twitter to authorize. Click **"Authorize app"**.
4. You're redirected back and your `@username` appears in the settings.
5. When creating or editing a bot, select this X account.

---

## Environment Variables

Copy `.env.example` to `.env` and set these values:

```env
# ── Required ───────────────────────────────────────────────────────────────
JWT_SECRET=                    # Random secret for signing JWTs (min 32 chars)
TOKEN_ENCRYPTION_KEY=          # 64-char hex string for encrypting X tokens

# ── Optional (defaults work for local dev) ────────────────────────────────
POSTGRES_PASSWORD=smartx_dev   # PostgreSQL password
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ── Anthropic Claude (AI tweet generation) ────────────────────────────────
ANTHROPIC_API_KEY=             # From console.anthropic.com
CLAUDE_MODEL=claude-sonnet-4-20250514

# ── Twitter / X OAuth 2.0 ─────────────────────────────────────────────────
TWITTER_CLIENT_ID=             # From developer.twitter.com → your app → Keys and Tokens
TWITTER_CLIENT_SECRET=         # Same as above

# ── Event Sources ─────────────────────────────────────────────────────────
RSS_FEED_URLS=https://www.espncricinfo.com/rss/content/story/feeds/0.xml
SPORTS_LEAGUE_IDS=             # TheSportsDB league IDs (comma-separated)

# ── Frontend ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## Running the App

### With Docker (recommended)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop everything
docker compose down

# Rebuild after code changes
docker compose build && docker compose up -d

# Reset database (WARNING: deletes all data)
docker compose down -v && docker compose up -d
```

### Without Docker (development mode)

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # edit with your local DB/Redis connection strings
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## API Overview

All endpoints are prefixed with `/api`. JWT Bearer token required (except auth).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, get tokens |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `GET`  | `/api/bots` | List your bots |
| `POST` | `/api/bots` | Create a bot |
| `PATCH`| `/api/bots/:id` | Update bot config |
| `GET`  | `/api/tweets` | List tweets (filter by status/bot) |
| `PATCH`| `/api/tweets/:id/approve` | Approve a draft tweet |
| `POST` | `/api/tweets/:id/post-now` | Post a tweet immediately |
| `GET`  | `/api/auth/x/authorize` | Start X OAuth flow |
| `GET`  | `/api/analytics/overview` | Dashboard stats |
| `POST` | `/api/admin/queues/scheduler/run-now` | Manually trigger scheduler |

Full interactive docs at **http://localhost:3000/api/docs** (Swagger UI).

---

## Project Structure

```
SmartX/
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── auth/             # JWT auth, login, register
│   │   ├── bots/             # Bot CRUD and config
│   │   ├── tweets/           # Tweet management + post-now
│   │   ├── events/           # Event ingestion (RSS, sports, crypto, news)
│   │   ├── ai-generation/    # Claude AI tweet generation
│   │   ├── posting/          # X API posting service
│   │   ├── scheduler/        # Cron jobs + BullMQ queue admin
│   │   ├── x-oauth/          # Twitter OAuth 2.0 PKCE flow
│   │   ├── analytics/        # Dashboard metrics
│   │   └── common/           # Guards, interceptors, Prisma service
│   └── prisma/
│       └── schema.prisma     # Database schema
├── frontend/                 # Next.js dashboard
│   └── src/app/
│       ├── dashboard/        # Overview, bots, tweets, analytics, settings
│       └── (auth)/           # Login, register pages
├── db/
│   └── schema.sql            # Raw SQL schema (reference)
├── infra/
│   └── k8s/                  # Kubernetes manifests
├── docs/                     # Architecture & phase docs
├── docker-compose.yml        # Local dev environment
└── .env.example              # Environment variable template
```

---

## Troubleshooting

**`JWT_SECRET is required` error on startup**
→ Your `.env` is missing or `JWT_SECRET` is empty. Run `openssl rand -base64 32` and add it.

**`TOKEN_ENCRYPTION_KEY is required` error**
→ Run `openssl rand -hex 32` (must be exactly 64 hex chars) and add to `.env`.

**X OAuth: "Not a valid URL format"**
→ Use `http://127.0.0.1:3000/api/auth/x/callback` — X rejects `localhost` but accepts `127.0.0.1`.

**No tweets being generated**
→ Check `ANTHROPIC_API_KEY` is set. Check `docker compose logs backend | grep -i error`. Retry failed jobs via `POST /api/admin/queues/event-processing/retry-failed`.

**Bot linked but tweets not posting**
→ Ensure the bot has an X account assigned and `isActive: true`. Check posting queue: `GET /api/admin/queues/tweet-posting`.
