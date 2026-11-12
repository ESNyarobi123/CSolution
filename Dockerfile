# syntax=docker/dockerfile:1

# Shared dependency layer. Kept separate so both the app image and the
# migration image reuse exactly the same installed packages.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Production build. The server runs on 1 vCPU, so the heap cap keeps the
# build inside the available memory instead of being killed.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=768
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# One-shot image for `npm run db:setup`. The standalone server image does not
# contain the SQL files or the setup script, so migrations need their own stage.
FROM node:22-bookworm-slim AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY db ./db
COPY scripts ./scripts
CMD ["npm", "run", "db:setup"]

# Runtime image. Next.js standalone output contains only the server and the
# modules it actually traced, which keeps this layer small.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3085
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# The Settings page streams a `pg_dump` archive, so the runtime image needs the
# PostgreSQL client. It must match the server major version, which is why it
# comes from the PostgreSQL archive and not the older client bundled by Debian.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Product photos are stored in PostgreSQL, but product URLs may point at
# local files under public/. Keep that writable by the runtime user.
RUN mkdir -p /app/public && chown -R nextjs:nodejs /app/public

USER nextjs
EXPOSE 3085
CMD ["node", "server.js"]
