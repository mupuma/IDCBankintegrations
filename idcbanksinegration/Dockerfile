# Production Dockerfile for Next.js app
FROM node:22-alpine AS builder
WORKDIR /app/idcbanksinegration

# install build deps
COPY idcbanksinegration/package.json idcbanksinegration/package-lock.json ./
RUN npm ci --production=false --prefer-offline --no-audit --progress=false

# copy source
COPY idcbanksinegration/ .
COPY shared /app/shared

# build
RUN npm run build

# Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/idcbanksinegration/.next/standalone ./
COPY --from=builder /app/idcbanksinegration/public ./idcbanksinegration/public
COPY --from=builder /app/idcbanksinegration/.next/static ./idcbanksinegration/.next/static
COPY --from=builder /app/shared /app/shared
WORKDIR /app/idcbanksinegration

EXPOSE 3000

CMD ["node", "server.js"]
