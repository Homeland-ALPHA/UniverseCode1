import { getDb } from '../db/mongo.js';

const COLLECTION = 'messages';

export function messagesCollection() {
  return getDb().collection(COLLECTION);
}

export async function createMessage(doc) {
  const col = messagesCollection();
  const now = new Date();
  return col.insertOne({ ...doc, sent_at: now, updated_at: now });
}

export async function updateMessageStatus(messageId, status) {
  const col = messagesCollection();
  await col.updateOne({ message_id: messageId }, { $set: { status, updated_at: new Date() } });
}

export async function findMessageById(messageId) {
  const col = messagesCollection();
  return col.findOne({ message_id: messageId });
}
