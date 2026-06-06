# Production Dockerfile for Next.js app
FROM node:18-alpine AS builder
WORKDIR /app

# install build deps
COPY package.json package-lock.json* ./
RUN npm ci --production=false --prefer-offline --no-audit --progress=false

# copy source
COPY . .

# build
RUN npm run build

# Runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
