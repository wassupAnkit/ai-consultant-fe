# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — deps: exact lockfile install (npm ci).
###############################################################################
FROM public.ecr.aws/docker/library/node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

###############################################################################
# Stage 2 — builder: `next build` with output: "standalone" (next.config.ts).
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they arrive as build args (CodeBuild passes them from Secrets Manager
# prod/expert-chatbot-frontend/app — see buildspec-prod.yaml). Empty
# NEXT_PUBLIC_GOOGLE_CLIENT_ID selects "open mode" (no login).
###############################################################################
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npm run build

###############################################################################
# Stage 3 — runner: standalone server + static assets + PWA public/ only.
###############################################################################
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Numeric form so Kubernetes runAsNonRoot can verify the user.
USER 1001:1001
EXPOSE 3000

# Server-runtime env (EDGE_API_URL, EDGE_API_KEY, ...) comes from the
# ConfigMap + Secret at deploy time. Exec form keeps node as PID 1 for SIGTERM.
CMD ["node", "server.js"]
