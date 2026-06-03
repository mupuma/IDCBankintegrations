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

# copy needed files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
