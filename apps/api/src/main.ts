import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression = require('compression');
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { assertProductionEnv } from './common/secrets';
import { HttpErrorFilter } from './common/http-error.filter';

async function bootstrap() {
  assertProductionEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpErrorFilter());

  const publicUrl = (process.env.API_PUBLIC_URL || '').trim().toLowerCase();
  const httpsPublic = publicUrl.startsWith('https://');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: httpsPublic
        ? undefined
        : {
            useDefaults: true,
            directives: {
              upgradeInsecureRequests: null,
            },
          },
      hsts: httpsPublic ? undefined : false,
      crossOriginOpenerPolicy: httpsPublic ? undefined : false,
    }),
  );
  app.use(compression());

  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const prod = process.env.NODE_ENV === 'production';

  const originAllowed = (origin: string) => {
    if (origins.includes(origin)) return true;
    // Dev only: allow http↔https swap for the same listed host.
    if (prod) return false;
    try {
      const u = new URL(origin);
      const alt = `${u.protocol === 'https:' ? 'http' : 'https'}://${u.host}`;
      return origins.includes(alt);
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        originAllowed(origin) ||
        (!prod &&
          (/^http:\/\/192\.168\.\d+\.\d+/.test(origin) ||
            /^http:\/\/10\./.test(origin) ||
            origin.startsWith('http://localhost')))
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // JSON APIs stay small; large payloads go through multipart upload routes.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const uploadRoot = path.join(process.cwd(), uploadDir);
  for (const dir of ['', 'invoices', 'documents', 'tickets', 'chat', 'avatars', 'brand']) {
    fs.mkdirSync(path.join(uploadRoot, dir), { recursive: true });
  }
  // Only public brand/avatar assets are statically served; documents stay behind auth.
  app.useStaticAssets(path.join(uploadRoot, 'avatars'), { prefix: '/uploads/avatars/' });
  app.useStaticAssets(path.join(uploadRoot, 'brand'), { prefix: '/uploads/brand/' });

  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port, '0.0.0.0');
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Intellisoft API listening on port ${port}`);
  }
}

bootstrap();
