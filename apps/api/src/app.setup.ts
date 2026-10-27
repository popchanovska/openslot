import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './config/env';

/** Shared by main.ts and the e2e tests so both run the exact same HTTP setup. */
export function configureApp(app: INestApplication) {
  const e = env();
  app.setGlobalPrefix('api');
  // Render sits behind a proxy; needed for correct client IPs in rate limiting.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.enableCors({
    origin: [e.FRONTEND_URL, 'http://localhost:5173'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  });
  app.enableShutdownHooks();
  return app;
}
