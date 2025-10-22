import { createAdapter } from '@socket.io/redis-adapter';
import { verifyAccessToken } from '../services/tokenService.js';
import { updateMessageStatus } from '../models/messages.js';

export function createSocketHub({ io, galaxyManager, redis }) {
  const { publisher, subscriber } = redis;
  io.adapter(createAdapter(publisher, subscriber));

  const attachedNamespaces = new Set();

  function attach() {
    io.on('connection', (socket) => {
      socket.emit('connected', { id: socket.id });
    });

    galaxyManager.cache.forEach((galaxy) => attachGalaxyNamespace(galaxy.galaxy_id));
    galaxyManager.on('galaxy:update', (galaxy) => {
      attachGalaxyNamespace(galaxy.galaxy_id);
    });
  }

  function attachGalaxyNamespace(galaxyId) {
    const namespaceName = `/galaxy-${galaxyId}`;
    if (attachedNamespaces.has(namespaceName)) {
      return io.of(namespaceName);
    }
    const namespace = io.of(namespaceName);
    attachedNamespaces.add(namespaceName);

    namespace.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) {
          return next(new Error('missing_token'));
        }
        const payload = verifyAccessToken(token);
        if (payload.galaxy_id !== galaxyId) {
          return next(new Error('galaxy_mismatch'));
        }
        socket.data.galaxyId = galaxyId;
        socket.data.user = payload;
        next();
      } catch (err) {
        next(new Error('unauthorized'));
      }
    });

    namespace.on('connection', (socket) => {
      socket.emit('authorized', { galaxyId, user: socket.data.user });

      socket.on('asteroidAck', async ({ messageId, status }) => {
        if (!messageId || !status) return;
        await updateMessageStatus(messageId, status);
      });
    });

    return namespace;
  }

  async function dispatchAsteroid({ galaxyId, messageId, chunkIndex, envelope }) {
    const namespace = attachGalaxyNamespace(galaxyId);
    namespace.emit('asteroidLaunch', { messageId, chunkIndex, envelope });
  }

  return { attach, attachGalaxyNamespace, dispatchAsteroid };
}
