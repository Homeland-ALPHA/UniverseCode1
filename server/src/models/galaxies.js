import { getDb } from '../db/mongo.js';

const COLLECTION = 'galaxies';

export function galaxiesCollection() {
  return getDb().collection(COLLECTION);
}

export async function listGalaxies() {
  const col = galaxiesCollection();
  return col.find({}).toArray();
}

export async function upsertGalaxy(galaxy) {
  const col = galaxiesCollection();
  await col.updateOne(
    { galaxy_id: galaxy.galaxy_id },
    { $set: galaxy },
    { upsert: true }
  );
}
