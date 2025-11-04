# Festive Fare Spin

Production-ready spin-to-win campaign for the "Festive Fare Spin" promotion.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

The `pnpm dev` command runs both the Next.js frontend (port 3000) and Express API (port 4000).

## Testing

```bash
pnpm test
```

## Structure

- `app/` – Next.js frontend
- `server/` – Express + Prisma backend
- `shared/` – Shared TypeScript contracts
- `prisma/` – Prisma schema & seed script

## API overview

- `GET /api/spin/config`
- `POST /api/spin`
- `GET /api/spin/my-prizes`
- `GET /api/spin/admin/summary`

All requests require JWT + HMAC signature as documented in the code.
