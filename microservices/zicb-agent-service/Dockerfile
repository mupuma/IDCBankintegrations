FROM node:22-alpine AS builder
WORKDIR /app/microservices/zicb-agent-service

COPY microservices/zicb-agent-service/package.json microservices/zicb-agent-service/package-lock.json ./
RUN npm ci --production=false --prefer-offline --no-audit --progress=false

COPY microservices/zicb-agent-service/ .
COPY shared/zicb-h2h /app/shared/zicb-h2h
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app/microservices/zicb-agent-service
ENV NODE_ENV=production

COPY --from=builder /app/microservices/zicb-agent-service/package.json ./package.json
COPY --from=builder /app/microservices/zicb-agent-service/dist ./dist
COPY --from=builder /app/microservices/zicb-agent-service/node_modules ./node_modules
COPY --from=builder /app/shared/zicb-h2h /app/shared/zicb-h2h

EXPOSE 4001
CMD ["node", "dist/server.js"]
