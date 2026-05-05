#!/usr/bin/env sh
set -e

npm install --include=dev
npx prisma generate
npm run build
