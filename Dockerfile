# Build stage
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Production stage
FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/lib/ ./lib/

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
