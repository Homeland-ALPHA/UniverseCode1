import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { connectMongo } from './db/mongo.js';
import { createRedisClient } from './db/redis.js';
import registerRestRoutes from './routes/index.js';
import { createSocketHub } from './services/socketHub.js';
import { GalaxyManager } from './services/galaxyManager.js';

dotenv.config();

const PORT = process.env.PORT || 8080;

function parseOrigins(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = express();
  const allowedOrigins = parseOrigins(process.env.CLIENT_ORIGIN);
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : '*',
      methods: ['GET', 'POST']
    }
  });

  const connectSrc = ["'self'", ...allowedOrigins];

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          connectSrc,
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'"],
          fontSrc: ["'self'", 'data:']
        }
      }
    })
  );
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

  const mongo = await connectMongo();
  const redis = await createRedisClient();

  const galaxyManager = new GalaxyManager({ mongo, redis });
  await galaxyManager.bootstrapNamespaces(io);
  await galaxyManager.startSync();

  const socketHub = createSocketHub({ io, galaxyManager, redis });
  socketHub.attach();

  registerRestRoutes(app, { mongo, redis, galaxyManager, socketHub });

  server.listen(PORT, () => {
    console.log(`[UniverseCode] Server listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[UniverseCode] Fatal bootstrap error', err);
  process.exit(1);
});
