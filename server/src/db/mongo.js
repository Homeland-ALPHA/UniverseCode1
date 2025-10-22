import { MongoClient } from 'mongodb';

let cachedClient;

export async function connectMongo() {
  if (cachedClient) {
    return cachedClient;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI env var required');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5_000
  });

  await client.connect();
  cachedClient = client;
  console.log('[UniverseCode] Mongo connected');
  return cachedClient;
}

export function getDb(name = process.env.MONGO_DB || 'universe_code') {
  if (!cachedClient) {
    throw new Error('Mongo client not ready');
  }
  return cachedClient.db(name);
}

export async function closeMongo() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
  }
}
