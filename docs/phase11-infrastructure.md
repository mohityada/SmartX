# Phase 11 — Cloud Architecture & Infrastructure

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CDN / Edge (CloudFront / Cloudflare)     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                        ┌──────▼──────┐
                        │   Ingress   │  (NGINX Ingress Controller)
                        │  + TLS/SSL  │  (cert-manager + Let's Encrypt)
                        └──────┬──────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
     ┌────────▼────────┐              ┌─────────▼────────┐
     │  Frontend (x2)  │              │  Backend (x2-10) │
     │  Next.js 16     │              │  NestJS 11       │
     │  Port 3001      │              │  Port 3000       │
     └─────────────────┘              └────────┬─────────┘
                                               │
                          ┌────────────────────┼──────────────────┐
                          │                    │                  │
                 ┌────────▼────┐     ┌─────────▼──────┐   ┌──────▼──────┐
                 │  PostgreSQL │     │     Redis      │   │  External   │
                 │  (Managed)  │     │   (Managed)    │   │   APIs      │
                 │             │     │  BullMQ Queues │   │  - Claude   │
                 │  11 Models  │     │  3 Queues:     │   │  - X API    │
                 │             │     │  ingestion     │   │             │
                 └─────────────┘     │  processing    │   └─────────────┘
                                     │  posting       │
                                     └────────────────┘
```

## Service Components

### Frontend — Next.js 16 (Standalone)
- **Runtime**: Node 22 Alpine container, `output: 'standalone'`
- **Scaling**: 2-6 replicas via HPA (CPU 70%)
- **Resources**: 100m-500m CPU, 128-256Mi memory per pod
- **Health**: HTTP GET `/` on port 3001

### Backend — NestJS 11
- **Runtime**: Node 22 Alpine container with dumb-init
- **Scaling**: 2-10 replicas via HPA (CPU 70%, memory 80%)
- **Resources**: 200m-1000m CPU, 256-512Mi memory per pod
- **Health Endpoints**:
  - `GET /api/health` — full status (DB + Redis latency)
  - `GET /api/health/live` — liveness probe
  - `GET /api/health/ready` — readiness probe
- **Queues**: 3 BullMQ queues (ingestion, processing, posting)

### PostgreSQL (Managed)
- **Cloud Options**: AWS RDS, GCP Cloud SQL, Azure Database for PostgreSQL
- **Version**: 16
- **HA**: Multi-AZ with automated failover
- **Backups**: Daily automated snapshots, 7-day retention
- **Schema**: 11 models managed by Prisma 7.5

### Redis (Managed)
- **Cloud Options**: AWS ElastiCache, GCP Memorystore, Azure Cache for Redis
- **Version**: 7+
- **Purpose**: BullMQ job queue broker (not caching)
- **Memory**: 256MB with allkeys-lru eviction
- **Persistence**: AOF enabled

## Networking

| Route | Service | Port |
|---|---|---|
| `smartx.example.com/*` | frontend | 3001 |
| `api.smartx.example.com/*` | backend | 3000 |

- TLS terminated at Ingress via cert-manager (Let's Encrypt)
- Internal service-to-service via ClusterIP (no public exposure)
- NGINX Ingress with 10m body size limit, 60s read timeout

## CI/CD Pipeline

### Pull Request → `ci.yml`
1. **Backend**: lint → build → test (with Postgres + Redis services)
2. **Frontend**: lint → build
3. Concurrency group cancels stale runs

### Merge to main → `deploy.yml`
1. Build backend Docker image → push to GHCR
2. Build frontend Docker image → push to GHCR (parallel)
3. Deploy to Kubernetes (sequential):
   - `sed` replaces image tags with commit SHA
   - `kubectl apply` all manifests
   - Wait for rollout completion

### Image Tagging
- `latest` — always points to HEAD of main
- `<short-sha>` — immutable tag per commit

## Secrets Management

| Secret | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `TOKEN_ENCRYPTION_KEY` | Encryption key for stored OAuth tokens |
| `ANTHROPIC_API_KEY` | Claude AI API key |
| `TWITTER_CLIENT_ID` | X OAuth2 client ID |
| `TWITTER_CLIENT_SECRET` | X OAuth2 client secret |

Secrets are provided via Kubernetes Secrets. For production, use:
- **AWS**: AWS Secrets Manager + External Secrets Operator
- **GCP**: Google Secret Manager + External Secrets Operator
- **Self-hosted**: Sealed Secrets or Vault

## Monitoring Strategy

### Health Checks
- Kubernetes liveness probes prevent zombie pods
- Readiness probes prevent traffic to unready pods
- Health endpoint reports DB + Redis latency

### Observability (Recommended Additions)
- **Metrics**: Prometheus + Grafana (CPU, memory, request rates, queue depths)
- **Logging**: Fluentd/Fluent Bit → Elasticsearch/Loki
- **Tracing**: OpenTelemetry → Jaeger/Tempo
- **Alerting**: Alertmanager rules for high error rates, queue backlog, DB connection pool exhaustion

## File Inventory

```
SmartX/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── src/health/         # Health check endpoints
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── next.config.ts      # output: 'standalone'
├── docker-compose.yml      # Local full-stack development
├── .env.example            # Environment variable template
├── .github/workflows/
│   ├── ci.yml              # Lint, build, test on PR
│   └── deploy.yml          # Build images + deploy on merge
└── infra/k8s/
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secrets.yaml
    ├── backend.yaml         # Deployment + Service
    ├── frontend.yaml        # Deployment + Service
    ├── redis.yaml           # Deployment + PVC + Service
    ├── ingress.yaml         # TLS + routing rules
    └── hpa.yaml             # Autoscalers
```
