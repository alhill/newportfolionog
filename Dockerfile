# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto de archivos
COPY . .

# Build de Astro
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copiar archivos necesarios desde builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Exponer puerto (Cloud Run usa PORT env variable)
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

# Comando para ejecutar la app
CMD ["node", "./dist/server/entry.mjs"]
