import { getDb } from '../db/mongo.js';

const COLLECTION = 'message_archives';

function archivesCollection() {
  return getDb().collection(COLLECTION);
}

export async function appendArchiveEntry(entry) {
  const col = archivesCollection();
  const now = new Date();
  await col.updateOne(
    { message_id: entry.message_id },
    {
      $set: {
        ...entry,
        created_at: now,
        updated_at: now
      }
    },
    { upsert: true }
  );
}

export async function listArchivesForUser(userId) {
  if (!userId) {
    return [];
  }
  const col = archivesCollection();
  return col
    .find(
      {
        $or: [{ sender_id: userId }, { receiver_id: userId }]
      },
      {
        projection: {
          _id: 0,
          message_id: 1,
          sender_id: 1,
          receiver_id: 1,
          created_at: 1,
          sentiment: 1
        }
      }
    )
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
}

export async function findArchiveById(messageId) {
  const col = archivesCollection();
  return col.findOne({ message_id: messageId }, { projection: { _id: 0 } });
}
