FROM node:20-bookworm-slim

# 1. Install OS packages required by Prisma engines.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install dependencies first to maximize Docker layer cache.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --include=dev

# 3. Copy source and build the app.
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"

# 4. Run migrations, then start Next.js on Render's port.
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && HOSTNAME=0.0.0.0 PORT=${PORT:-10000} npm run start"]
