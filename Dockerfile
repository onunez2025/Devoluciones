# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
