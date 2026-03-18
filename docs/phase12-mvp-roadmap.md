# Phase 12 — MVP Roadmap

## MVP Definition

The Minimum Viable Product enables a user to **sign up, connect their X account, create a bot, and have tweets automatically generated and posted**. This is the core value loop.

## Feature Prioritization

### P0 — Launch Blockers (Must-have for MVP)
| Feature | Status | Notes |
|---|---|---|
| User auth (register, login, JWT) | ✅ Done | |
| Bot CRUD with topics & event subs | ✅ Done | |
| Event ingestion pipeline | ✅ Done | Cron-based, 4 adapters |
| AI tweet generation (Claude) | ✅ Done | Content filtering included |
| Tweet scheduling & posting | ✅ Done | Rate limiting, retries |
| Tweet approval workflow | ✅ Done | |
| X OAuth authorization flow | ✅ Done | PKCE flow, token encryption |
| X account linking UI | ✅ Done | Connect/disconnect in settings |
| Health checks & monitoring | ✅ Done | 3 probe endpoints |
| Docker + CI/CD | ✅ Done | |

### P1 — Required for Public Launch
| Feature | Status | Notes |
|---|---|---|
| Email verification | ❌ Missing | `emailVerified` field exists, needs flow |
| Password reset | ❌ Missing | Forgot password → email → reset |
| Tweet metrics sync | ❌ Missing | DB fields ready, needs cron job |
| API rate limiting | ✅ Done | Per-bot daily limits, Redis sliding window |
| Subscription enforcement | ⚠️ Partial | maxTweetsPerDay enforced, maxBots not yet |

### P2 — Growth Features (Post-Launch)
| Feature | Notes |
|---|---|
| Stripe billing integration | Payment processing, plan management |
| Onboarding wizard | Guided first-time user experience |
| X account management UI | View/manage multiple X accounts |
| Batch tweet operations | Bulk approve/delete/reschedule |
| Notification system | In-app + email notifications |
| Export analytics | CSV/PDF reports |
| Team collaboration | Multi-user workspace |

---

## Sprint Roadmap

### Week 1 — X OAuth & Account Linking ✅ COMPLETE

**Goal**: Users can connect their X account and bots can post.

**Backend tasks:**
- [x] `GET /auth/x/authorize` — Redirect to X OAuth2 authorization screen
  - Generate PKCE code challenge
  - Store state + code_verifier in session/Redis
  - Redirect to `https://twitter.com/i/oauth2/authorize`
- [x] `GET /auth/x/callback` — Handle OAuth callback
  - Exchange code for access + refresh tokens
  - Encrypt tokens via existing `TokenCryptoService`
  - Create/update `XAccount` record linked to user
  - Redirect to frontend success page
- [x] `GET /users/me/x-accounts` — List user's connected X accounts
- [x] `DELETE /users/me/x-accounts/:id` — Disconnect an X account
- [x] `PATCH /bots/:id` — Allow setting `xAccountId` on a bot

**Frontend tasks:**
- [x] "Connect X Account" button → redirects to backend OAuth URL
- [x] `/auth/x/callback` page — handles redirect, shows success/error
- [x] X accounts list in Settings page
- [x] Bot edit form: select X account dropdown
- [x] Connection status indicators on bot cards

**Deliverable**: End-to-end flow from account connection to first published tweet.

---

### Week 2 — Email Verification & Password Reset (P1)

**Goal**: Secure user accounts, prevent abuse.

**Backend tasks:**
- [ ] Email service module (Resend or SendGrid integration)
- [ ] `POST /auth/verify-email` — Send verification email with signed token
- [ ] `GET /auth/verify-email/:token` — Verify email via link
- [ ] `POST /auth/forgot-password` — Send reset email
- [ ] `POST /auth/reset-password` — Reset with token
- [ ] Guard: block bot creation if email not verified

**Frontend tasks:**
- [ ] Email verification banner on dashboard
- [ ] Forgot password page
- [ ] Reset password page
- [ ] Email verified badge in settings

**Deliverable**: Complete email-based account security flow.

---

### Week 3 — Engagement Metrics & Rate Limiting (P1)

**Goal**: Analytics show real data. API is protected from abuse.

**Backend tasks:**
- [ ] Tweet metrics cron job — poll X API for impressions, likes, retweets, replies
  - Batch fetch using tweet IDs from last 7 days
  - Update `Tweet` records with latest metrics
  - Respect X API rate limits (300 requests/15 min for tweet lookup)
- [ ] Global rate limiting middleware (Throttler module)
  - 100 requests/min per authenticated user
  - 20 requests/min for unauthenticated endpoints
- [ ] Per-bot daily tweet limit enforcement from subscription plan

**Frontend tasks:**
- [ ] Analytics dashboard shows real engagement data
- [ ] Engagement metrics on individual tweet detail
- [ ] Rate limit error handling (429 toast notification)

**Deliverable**: Live engagement tracking and abuse protection.

---

### Week 4 — Stabilization, Subscription & Beta Prep

**Goal**: Platform is production-ready for beta users.

**Backend tasks:**
- [ ] Stripe integration (checkout session, webhook handler, portal)
  - `POST /subscriptions/checkout` — create Stripe checkout session
  - `POST /webhooks/stripe` — handle `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
  - `GET /subscriptions/portal` — redirect to Stripe customer portal
- [ ] Subscription plan enforcement middleware
  - Check bot count against plan limit
  - Check daily tweet count against plan limit
- [ ] Seed subscription plans (Free, Pro, Business)
- [ ] Error handling audit and edge case fixes
- [ ] Load testing (k6 or Artillery) on critical paths

**Frontend tasks:**
- [ ] Pricing/plan selection page
- [ ] Upgrade prompt when hitting plan limits
- [ ] Subscription status in settings
- [ ] Polish: loading states, error boundaries, empty states
- [ ] Mobile responsive audit

**Deliverable**: Beta-ready platform with monetization.

---

## Success Metrics

| Metric | Target |
|---|---|
| User can sign up → connect X → create bot → see first tweet posted | < 5 min |
| Tweet generation latency (event → generated tweet) | < 30s |
| Tweet posting success rate | > 95% |
| Health check uptime | > 99.5% |
| API p95 latency | < 500ms |

## Tech Debt to Address

- [ ] Add comprehensive E2E tests (Playwright for frontend, Supertest for backend)
- [ ] Add request validation pipes across all endpoints
- [ ] Implement structured logging (Pino/Winston with request IDs)
- [ ] Database connection pooling tuning (PgBouncer if needed)
- [ ] Add Sentry or similar error tracking
- [ ] Security audit: CORS config, CSP headers, input sanitization review

## Current Implementation Status

```
Feature Pipeline:
  [Register] → [Login] → [Connect X ✅] → [Create Bot] → [Events Ingested]
                                                              ⬇
                                                    [AI Generates Tweets]
                                                              ⬇
                                                        [Scheduled]
                                                              ⬇
                                                      [Posted to X ✅]
```

**Bottom line**: The core MVP pipeline is fully operational — users can register, connect their X account via OAuth, create bots, and have tweets automatically generated and posted. Remaining work is P1/P2 features (email verification, metrics cron, Stripe billing).
