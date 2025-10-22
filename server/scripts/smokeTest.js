import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import supertest from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, closeMongo } from '../src/db/mongo.js';
import { createRedisClient } from '../src/db/redis.js';
import registerRestRoutes from '../src/routes/index.js';
import { GalaxyManager } from '../src/services/galaxyManager.js';
import { createSocketHub } from '../src/services/socketHub.js';

async function bootstrapTestApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 240 }));

  const mongo = await connectMongo();
  const redis = await createRedisClient();

  const galaxyManager = new GalaxyManager({ mongo, redis });
  await galaxyManager.bootstrapNamespaces(io);
  await galaxyManager.startSync();

  const socketHub = createSocketHub({ io, galaxyManager, redis });
  socketHub.attach();

  registerRestRoutes(app, { mongo, redis, galaxyManager, socketHub });

  return { app, server, io };
}

async function run() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.CLIENT_ORIGIN = '*';
  process.env.REDIS_URL = 'memory://local';
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.MONGO_DB = 'universe_code_test';

  const { app, server, io } = await bootstrapTestApp();
  const request = supertest(app);

  const registerSender = await request.post('/api/users/register').send({
    username: 'sender001',
    password: 'UltraSecurePass!1',
    keyPassphrase: 'sender-passphrase-secret'
  });
  if (registerSender.status !== 201) throw new Error('Sender registration failed');
  const senderToken = registerSender.body.token;
  const senderId = registerSender.body.user.user_id;

  const registerReceiver = await request.post('/api/users/register').send({
    username: 'receiver001',
    password: 'UltraSecurePass!1',
    keyPassphrase: 'receiver-passphrase-secret'
  });
  if (registerReceiver.status !== 201) throw new Error('Receiver registration failed');
  const receiverId = registerReceiver.body.user.user_id;

  const messageRes = await request
    .post('/api/messages/send')
    .set('Authorization', `Bearer ${senderToken}`)
    .send({ receiver_id: receiverId, plaintext: 'Classified payload alpha.' });
  if (messageRes.status !== 202) throw new Error('Message send failed');

  const detailRes = await request
    .get(`/api/messages/${messageRes.body.message_id}`)
    .set('Authorization', `Bearer ${senderToken}`);
  if (detailRes.status !== 200) throw new Error('Message detail fetch failed');

  const historyRes = await request
    .get('/api/messages/history')
    .set('Authorization', `Bearer ${senderToken}`);
  if (historyRes.status !== 200) throw new Error('History retrieval failed');

  const replayRes = await request
    .post('/api/messages/replay')
    .set('Authorization', `Bearer ${senderToken}`)
    .send({ message_id: messageRes.body.message_id });
  if (replayRes.status !== 200) throw new Error('Replay failed');

  console.log('[SmokeTest] Message pipeline ok:', {
    messageId: messageRes.body.message_id,
    chunks: messageRes.body.chunks,
    sentiment: messageRes.body.sentiment?.label,
    historyCount: historyRes.body.history?.length,
    detailChecksum: detailRes.body.message?.checksum
  });

  await closeMongo();
  await mongoServer.stop();
  io.close();
  server.close();
}

run().catch((err) => {
  console.error('[SmokeTest] Failed', err);
  process.exit(1);
});
