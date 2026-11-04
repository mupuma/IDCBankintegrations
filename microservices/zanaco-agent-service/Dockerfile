FROM node:22-alpine AS builder
WORKDIR /app/microservices/zanaco-agent-service

COPY microservices/zanaco-agent-service/package.json microservices/zanaco-agent-service/package-lock.json ./
RUN npm ci --production=false --prefer-offline --no-audit --progress=false

COPY microservices/zanaco-agent-service/ .
COPY shared/http-logging /app/shared/http-logging
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app/microservices/zanaco-agent-service
ENV NODE_ENV=production

COPY --from=builder /app/microservices/zanaco-agent-service/package.json ./package.json
COPY --from=builder /app/microservices/zanaco-agent-service/dist ./dist
COPY --from=builder /app/microservices/zanaco-agent-service/node_modules ./node_modules
COPY --from=builder /app/shared/http-logging /app/shared/http-logging

EXPOSE 4003
CMD ["node", "dist/server.js"]
