# Intellisoft Client Platform

Client billing and service management for Intellisoft.

- **Client portal:** web app for clients (`apps/web`) — bills, services, projects, documents
- **Staff CMS:** billing, quotes, renewals, inbox, projects, documents, catalog, reports, staff
- **API:** NestJS + Prisma + PostgreSQL; GST, bank payments, SMTP, PDF invoices
- **Mobile client:** private native app (not published in this repository)

Production on Hostinger + Cloudflare HTTPS: see `deploy/hostinger.md`. Deploy with `npm run deploy:prod` after configuring `.env.production` (`API_PUBLIC_URL=https://api-client.theintellisoft.com`).

## Quick start

**1. Install dependencies** (from the repo root)

```bash
npm install
```

**2. Start PostgreSQL and configure env**

```bash
npm run db:up
copy apps\api\.env.example apps\api\.env
copy apps\cms\.env.example apps\cms\.env.local
copy apps\web\.env.example apps\web\.env.local
```

The API connects to PostgreSQL via Docker (`DATABASE_URL` in `apps/api/.env`).

**3. Migrate and seed**

```bash
npm run db:migrate
npm run db:seed
```

**4. Run apps** (separate terminals)

```bash
npm run dev:api      # http://localhost:3000
npm run dev:cms      # http://localhost:3001
npm run dev:web      # http://localhost:3002
```

Staff accounts are created by seed / ops scripts. **Do not put real passwords in git.**

## Payments

- Clients clear invoices by **bank transfer** (details in the client portal / app and public pay links)
- Staff mark invoices paid offline in CMS (**BANK** / **CASH** / **CHEQUE**) after confirming credit
- No Razorpay or Stripe integration

## Workspaces

```
apps/api         NestJS API
apps/cms         Staff CMS
apps/web         Client web portal
packages/shared  Shared types and GST helpers
```
