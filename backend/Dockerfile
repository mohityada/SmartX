# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

# Non-root user
RUN addgroup -S smartx && adduser -S smartx -G smartx

WORKDIR /app

# Copy production artifacts
COPY --from=builder --chown=smartx:smartx /app/dist ./dist
COPY --from=builder --chown=smartx:smartx /app/node_modules ./node_modules
COPY --from=builder --chown=smartx:smartx /app/package.json ./
COPY --from=builder --chown=smartx:smartx /app/prisma ./prisma
COPY --from=builder --chown=smartx:smartx /app/prisma.config.ts ./

USER smartx

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# dumb-init handles PID 1 + signal forwarding
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --skip-generate && node dist/src/main.js"]
