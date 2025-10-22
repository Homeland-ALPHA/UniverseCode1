import Redis from 'ioredis';
import { EventEmitter } from 'node:events';

let publisher;
let subscriber;
let general;
let isMock = false;

export async function createRedisClient() {
  if (general && publisher && subscriber) {
    return { general, publisher, subscriber, isMock };
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL env var required');
  }

  if (url.startsWith('memory://')) {
    return setupInMemoryRedis();
  }

  general = new Redis(url, { lazyConnect: false });
  publisher = new Redis(url, { lazyConnect: false });
  subscriber = new Redis(url, { lazyConnect: false });
  isMock = false;

  general.on('error', (err) => console.error('[UniverseCode] Redis error', err));
  publisher.on('error', (err) => console.error('[UniverseCode] Redis pub error', err));
  subscriber.on('error', (err) => console.error('[UniverseCode] Redis sub error', err));

  await Promise.all([
    general.ping(),
    publisher.ping(),
    subscriber.ping()
  ]);

  console.log('[UniverseCode] Redis connected');
  return { general, publisher, subscriber, isMock };
}

function setupInMemoryRedis() {
  if (general && publisher && subscriber) {
    return { general, publisher, subscriber, isMock: true };
  }

  const subscribers = new Set();

  const matchesPattern = (pattern, channel) => {
    if (pattern === channel) return true;
    if (pattern.endsWith('*')) {
      const base = pattern.slice(0, -1);
      return channel.startsWith(base);
    }
    return false;
  };

  const factory = () => {
    const client = new EventEmitter();
    client.__patterns = new Set();
    client.__channels = new Set();

    client.ping = async () => 'PONG';
    client.publish = async (channel, message) => {
      setImmediate(() => {
        subscribers.forEach((sub) => {
          if (sub.__channels?.has(channel)) {
            sub.emit('message', channel, message);
          }
          sub.__patterns?.forEach((pattern) => {
            if (matchesPattern(pattern, channel)) {
              sub.emit('pmessage', pattern, channel, message);
            }
          });
        });
      });
      return 1;
    };
    client.subscribe = async (channel) => {
      subscribers.add(client);
      client.__channels.add(channel);
      return 1;
    };
    client.unsubscribe = async (channel) => {
      client.__channels.delete(channel);
      return 1;
    };
    client.psubscribe = async (pattern) => {
      subscribers.add(client);
      client.__patterns.add(pattern);
      return 1;
    };
    client.punsubscribe = async (pattern) => {
      client.__patterns.delete(pattern);
      return 1;
    };
    client.quit = async () => {};
    client.on('error', () => {});
    return client;
  };

  general = factory();
  publisher = factory();
  subscriber = factory();
  isMock = true;

  console.log('[UniverseCode] Using in-memory Redis mock');
  return { general, publisher, subscriber, isMock };
}
