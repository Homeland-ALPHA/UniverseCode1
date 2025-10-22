import { getDb } from '../db/mongo.js';

const COLLECTION = 'users';

export function usersCollection() {
  return getDb().collection(COLLECTION);
}

export async function createUser(doc) {
  const col = usersCollection();
  const now = new Date();
  return col.insertOne({ ...doc, created_at: now, updated_at: now });
}

export async function findUserByUsername(username) {
  const col = usersCollection();
  return col.findOne({ username });
}

export async function findUserById(userId) {
  const col = usersCollection();
  return col.findOne({ user_id: userId });
}

export async function searchUsersDirectory({ search = '', limit = 25 } = {}) {
  const col = usersCollection();
  const filter = search
    ? {
        username: {
          $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i'
        }
      }
    : {};
  return col
    .find(filter, {
      projection: {
        _id: 0,
        user_id: 1,
        username: 1,
        galaxy_id: 1,
        region: 1
      }
    })
    .limit(Math.min(Math.max(limit, 1), 50))
    .sort({ username: 1 })
    .toArray();
}
