# El token del registro privado de Forgejo, necesario para bajar @siatc/c4c-client.
# Dokploy lo pasa como argumento de construccion. Ver el README del paquete.
ARG FORGEJO_TOKEN=""

# Build stage
FROM node:22-slim AS builder
ARG FORGEJO_TOKEN
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN printf '//git.siatc.cloud/api/packages/MT_Ind/npm/:_authToken=%s\n' "$FORGEJO_TOKEN" > /root/.npmrc \
 && pnpm install --frozen-lockfile \
 && rm -f /root/.npmrc
COPY . .
RUN pnpm run build

# Production stage
FROM node:22-slim
ARG FORGEJO_TOKEN
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN printf '//git.siatc.cloud/api/packages/MT_Ind/npm/:_authToken=%s\n' "$FORGEJO_TOKEN" > /root/.npmrc \
 && pnpm install --frozen-lockfile --prod \
 && rm -f /root/.npmrc
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/ ./server/

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
