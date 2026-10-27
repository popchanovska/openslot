import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { env } from './config/env';

/** The built React app (apps/web/dist). In production the API serves it, so the whole app is one service. */
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

async function bootstrap() {
  const e = env(); // fail fast on a bad config
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const log = new Logger('Bootstrap');
  if (existsSync(path.join(WEB_DIST, 'index.html'))) {
    app.useStaticAssets(WEB_DIST, { index: false, maxAge: '1h' });
    // Any non-API page (/, /instructor, a reload) gets index.html; React Router takes it from there.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(WEB_DIST, 'index.html'));
    });
    log.log('Serving the web app from apps/web/dist');
  }

  await app.listen(e.PORT, '0.0.0.0');
  log.log(`API on http://localhost:${e.PORT}/api (time zone ${e.APP_TIMEZONE})`);
  log.log(`Gemini: ${e.GEMINI_API_KEY ? e.GEMINI_MODEL : 'off (template confirmations)'}`);
  log.log(`Google Calendar: ${e.GOOGLE_CLIENT_ID ? 'configured' : 'off'}`);
}

bootstrap();
