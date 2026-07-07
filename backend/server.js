import 'dotenv/config';
import http    from 'http';
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';

import { config }                from './src/config/index.js';
import { testSupabaseConnection } from './src/config/supabase.js';
import { logger }                 from './src/utils/logger.js';
import { initSocketServer }       from './src/socket/index.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { apiLimiter }             from './src/middleware/rateLimit.js';
import apiRoutes                  from './src/routes/index.js';

async function bootstrap() {
  // 1. Supabase — required in production, optional for local guest testing.
  const ok = await testSupabaseConnection();
  if (!ok && !config.isDev) {
    logger.error('Supabase is required but could not connect. Check your .env credentials.');
    process.exit(1);
  }

  // 2. Express
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.cors.origins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(config.isDev ? 'dev' : 'combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));

  // 3. Routes
  app.use('/api/v1', apiLimiter, apiRoutes);
  app.use(notFound);
  app.use(errorHandler);

  // 4. HTTP + Socket.io
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(config.port, () => {
    logger.info('🚀 WatchParty server running', { port: config.port, env: config.env });
  });

  // 5. Graceful shutdown
  const shutdown = (sig) => {
    logger.info(`${sig} received — shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => logger.error('Unhandled rejection', { r }));
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
