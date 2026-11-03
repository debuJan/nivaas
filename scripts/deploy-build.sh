#!/usr/bin/env bash
set -e
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
npx prisma generate --schema prisma/schema.prod.prisma
npx prisma db push --schema prisma/schema.prod.prisma
npx prisma db seed --schema prisma/schema.prod.prisma
npm run build
