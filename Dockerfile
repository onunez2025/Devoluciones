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
COPY --from=builder /app/.env ./ 
# Nota: En Easypanel las variables de entorno se suelen manejar desde el panel, 
# pero copiamos el archivo por si acaso o usamos variables de entorno reales.

# Instalar tsx para ejecutar el servidor
RUN npm install -g tsx

EXPOSE 3000
CMD ["tsx", "server.ts"]
