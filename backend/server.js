import 'dotenv/config';
import http    from 'http';
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';
import { createRequire } from 'module';

// CJS interop for avatar-system and game-engine (CommonJS packages)
const require = createRequire(import.meta.url);
const { createAvatarModule, grantXp } = require('./src/avatar/index.js');
const { attachGamesWithAvatarXp }     = require('./src/game-engine/index.js');

import { config }                from './src/config/index.js';
import { testSupabaseConnection } from './src/config/supabase.js';
import { logger }                 from './src/utils/logger.js';
import { initSocketServer }       from './src/socket/index.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { apiLimiter }             from './src/middleware/rateLimit.js';
import apiRoutes                  from './src/routes/index.js';

async function bootstrap() {
  // 1. Supabase — required (all state lives here now)
  const ok = await testSupabaseConnection();
  const isDev = process.env.NODE_ENV !== 'production';
  if (!ok) {
    if (isDev) {
      logger.warn('Supabase not connected — running in DEV mode with in-memory storage.');
    } else {
      logger.error('Supabase is required in production but could not connect. Check your .env credentials.');
      process.exit(1);
    }
  }

  // 2. Express
  const app = express();
  app.set('trust proxy', 1);
  // SECURITY (M2): enable CSP. 'unsafe-inline' is kept for styles because the
  // SPA injects some inline styles; tighten further once the frontend is audited.
  // mediaSrc/connectSrc are permissive to allow HLS/CDN playback + websockets.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'https:'],
        mediaSrc:    ["'self'", 'https:', 'blob:'],
        connectSrc:  ["'self'", 'https:', 'wss:'],
        frameSrc:    ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      },
    },
    crossOriginEmbedderPolicy: false,   // needed for cross-origin media/YouTube embeds
  }));
  app.use(cors({ origin: config.cors.origins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(config.isDev ? 'dev' : 'combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));

  // 3. Routes — avatar-system gets its own 16 MB JSON limit (for snapshot uploads)
  app.use('/api/v1/avatar-system', createAvatarModule().router);
  app.use('/api/v1', apiLimiter, apiRoutes);
  app.use(notFound);
  app.use(errorHandler);

  // 4. HTTP + Socket.io
  const httpServer = http.createServer(app);
  const io = initSocketServer(httpServer);
  attachGamesWithAvatarXp(io);

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
