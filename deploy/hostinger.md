# Hostinger VPS production (Intellisoft)

Recommended VPS: **KVM 2 vCPU / 4 GB RAM** (Ubuntu 24.04). The stack runs as Docker Compose: PostgreSQL, NestJS API, Next.js CMS, nginx.

## Architecture

```
Internet → Cloudflare (HTTPS) → nginx (:80) → api-client.theintellisoft.com → API :3000
                                            → cms-client.theintellisoft.com → CMS :3001
                                            → client.theintellisoft.com     → Web portal :3002
PostgreSQL (internal) ← API
uploads volume ← API (invoices, documents, chat files)
```

Public URLs are **HTTPS** (Cloudflare Flexible). The VPS keeps plain HTTP on port 80 only. CMS, portal, and the Android app all call `https://api-client.theintellisoft.com`.

**Hostnames use a single label under the domain** (`api-client`, `cms-client`, `client`) so Free Cloudflare Universal SSL (`*.theintellisoft.com`) covers them. Do not use `api.client` / `cms.client` — Free SSL does not cover those deeper names.

## 1. DNS (Cloudflare)

Create A records pointing to the VPS IP, then **proxy (orange-cloud)**:

| Host | Purpose |
|------|---------|
| `api-client.theintellisoft.com` | NestJS API |
| `cms-client.theintellisoft.com` | Staff CMS |
| `client.theintellisoft.com` | Client web portal |

In Cloudflare DNS, the **Name** fields are: `api-client`, `cms-client`, `client`.

Optional: `www.client` → redirect to `client.theintellisoft.com`.

`deploy/nginx.conf` proxies the three hosts above (HTTP origin; Cloudflare terminates TLS).

If you still have old `api.client` / `cms.client` / `*.inso-client` records, remove or redirect them after cutover.

## 2. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

Clone or upload the project, then:

```bash
cd intellisoft-client
```

## 3. Production environment

```bash
cp .env.production.example .env.production
nano .env.production
```

**Required values:**

| Variable | Example |
|----------|---------|
| `POSTGRES_PASSWORD` | long random password |
| `JWT_SECRET` | 64+ char random |
| `JWT_REFRESH_SECRET` | different 64+ char random |
| `API_PUBLIC_URL` | `https://api-client.theintellisoft.com` |
| `CLIENT_APP_URL` | `https://client.theintellisoft.com` |
| `CORS_ORIGINS` | both `https://` and `http://` for CMS + portal (see `.env.production.example`) |

**Payments:** bank / cash / cheque only (no Razorpay/Stripe). Clients use bank transfer; staff confirm in CMS.

**SMTP** (Hostinger email works out of the box):

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
```

Compose reads `${POSTGRES_PASSWORD}` and `${API_PUBLIC_URL}` from this file via `--env-file`.

## 4. Deploy

From the repo root:

```bash
npm run deploy:prod
```

This builds images (CMS/web bake `NEXT_PUBLIC_API_URL` at build time from `API_PUBLIC_URL`), runs `prisma migrate deploy`, and starts all services.

**Seed demo data once** (first launch only — wipes existing data):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  /repo/node_modules/.bin/prisma db seed
```

Then change staff passwords in CMS → Staff.

## 5. HTTPS (Cloudflare Flexible — keep origin HTTP)

Intellisoft runs **HTTP on the VPS** (`nginx` `:80` only). Put TLS at Cloudflare:

1. Add the three hostnames in Cloudflare (orange-cloud / proxied): `api-client`, `cms-client`, `client`.
2. **SSL/TLS → Overview → Flexible** (visitor HTTPS → Cloudflare → origin HTTP).
3. Do **not** install Certbot on the VPS for this setup.
4. Keep in `.env.production`:
   - `API_PUBLIC_URL=https://api-client.theintellisoft.com`
   - `CLIENT_APP_URL=https://client.theintellisoft.com`
   - both `http://` and `https://` entries in `CORS_ORIGINS`
5. Rebuild after any `API_PUBLIC_URL` change so Next apps bake `https://…`.

**Optional — Certbot on VPS** only if you skip Cloudflare and want origin HTTPS, or use Cloudflare **Full** with a real cert on nginx.

## 6. Mobile client

The native client app is maintained privately (outside this repository) and is **not** deployed on the VPS. Release builds use `https://api-client.theintellisoft.com` (default in Gradle). Rebuild APK after the hostname cutover.

```bash
cd apps/android
./gradlew.bat assembleRelease
# or: ./gradlew.bat assembleRelease -PAPI_URL=https://api-client.theintellisoft.com
```

## 7. Backups

Daily cron on the VPS:

```bash
chmod +x deploy/backup.sh
0 2 * * * cd /path/to/intellisoft-client && ./deploy/backup.sh
```

Manual backup:

```bash
npm run deploy:backup
```

Backups include PostgreSQL dump + uploads tarball. Copy `backups/` off-server weekly.

## 8. Updates

```bash
git pull
npm run deploy:prod
```

Schema changes apply automatically via `prisma migrate deploy` on API container start.

## 9. Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness (no DB) |
| `GET /ready` | Readiness (DB + required schema columns/tables) |

Docker healthchecks and nginx upstreams use these internally.

## 10. Resource usage (4 GB VPS)

| Service | Memory limit |
|---------|-------------|
| PostgreSQL | 512 MB |
| API | 768 MB |
| CMS | 768 MB |
| Web portal | 512 MB |
| nginx | 128 MB |

Leaves ~2 GB for OS and spikes. Upgrade to 8 GB if you add more services.

## Useful commands

```bash
npm run deploy:prod:logs     # follow logs
npm run deploy:prod:down     # stop stack
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## Local dev vs production

| | Local | Production |
|---|-------|------------|
| Database | `docker compose up -d` (Postgres on 127.0.0.1:5432) | Postgres in prod compose |
| Schema | `npm run db:migrate` (db push) | `prisma migrate deploy` |
| CMS API URL | `http://localhost:3000` | baked at Docker build (`https://api-client…`) |
| Uploads | local `uploads/` folder | Docker volume |
