import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuid } from 'uuid';
import { generateSessionKey, wrapSessionKeyWithRsa, encryptMessage, computeChecksum } from '../utils/crypto.js';
import { derivePhysicsState } from '../utils/physicsEncoder.js';
import { findUserById } from '../models/users.js';
import { createMessage, findMessageById, updateMessageStatus } from '../models/messages.js';
import { evaluateSentiment } from '../services/sentimentService.js';
import { appendArchiveEntry, listArchivesForUser, findArchiveById } from '../models/archives.js';

const sendSchema = Joi.object({
  receiver_id: Joi.string().uuid().required(),
  plaintext: Joi.string().min(1).max(8192).required()
});

function chunkBuffer(buffer, size) {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += size) {
    chunks.push(buffer.subarray(offset, offset + size));
  }
  return chunks;
}

export default function messageRoutes({ galaxyManager, socketHub }) {
  const router = Router();

  router.post('/send', async (req, res, next) => {
    try {
      const { value, error } = sendSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const senderId = req.user?.sub;
      if (!senderId) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const sender = await findUserById(senderId);
      const receiver = await findUserById(value.receiver_id);
      if (!sender || !receiver) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      const sentiment = evaluateSentiment(value.plaintext);

      const sessionKey = generateSessionKey();
      const aad = `${sender.user_id}->${receiver.user_id}`;
      const envelope = encryptMessage(sessionKey, value.plaintext, aad);
      const ciphertextBuffer = Buffer.from(envelope.payload, 'base64');

      const wrappedKey = wrapSessionKeyWithRsa(receiver.public_key, sessionKey);
      const galaxyNonce = galaxyManager.getGalaxyNonce(receiver.galaxy_id);
      if (!galaxyNonce) {
        return res.status(500).json({ error: 'galaxy_nonce_missing' });
      }

      const chunkSize = 24; // 192-bit physical chunks
      const chunks = chunkBuffer(ciphertextBuffer, chunkSize);
      const physics = chunks.map((chunk, index) =>
        derivePhysicsState({
          galaxyNonce,
          senderId: sender.user_id,
          receiverId: receiver.user_id,
          chunkIndex: index,
          chunkCiphertext: chunk,
          extras: { color: sentiment.color, sentimentLabel: sentiment.label }
        })
      );

      const checksum = computeChecksum(ciphertextBuffer);
      const messageId = uuid();

      await createMessage({
        message_id: messageId,
        sender_id: sender.user_id,
        receiver_id: receiver.user_id,
        encrypted_payload: envelope,
        wrapped_session_key: wrappedKey,
        checksum,
        status: 'pending',
        physics,
        sentiment
      });

      await appendArchiveEntry({
        message_id: messageId,
        sender_id: sender.user_id,
        receiver_id: receiver.user_id,
        galaxy_id: receiver.galaxy_id,
        checksum,
        envelope,
        wrapped_session_key: wrappedKey,
        physics,
        sentiment
      });

      await Promise.all(
        physics.map((state) =>
          socketHub.dispatchAsteroid({
            galaxyId: receiver.galaxy_id,
            messageId,
            chunkIndex: state.chunkIndex,
            envelope: {
              physics: state,
              metadata: {
                sessionKeyWrapped: wrappedKey,
                checksum,
                sentiment
              }
            }
          })
        )
      );

      res.status(202).json({ message_id: messageId, chunks: physics.length, sentiment });
    } catch (err) {
      next(err);
    }
  });

  router.get('/history', async (req, res, next) => {
    try {
      const entries = await listArchivesForUser(req.user?.sub);
      res.json({ history: entries });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:messageId', async (req, res, next) => {
    try {
      const messageId = req.params.messageId;
      const userId = req.user?.sub;
      if (!messageId || !userId) {
        return res.status(400).json({ error: 'message_id_required' });
      }

      const record = await findMessageById(messageId);
      if (!record) {
        return res.status(404).json({ error: 'not_found' });
      }

      if (record.sender_id !== userId && record.receiver_id !== userId) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const isReceiver = record.receiver_id === userId;
      if (isReceiver && record.status !== 'read') {
        await updateMessageStatus(messageId, 'read');
        record.status = 'read';
      }

      res.json({
        message: {
          message_id: record.message_id,
          sender_id: record.sender_id,
          receiver_id: record.receiver_id,
          encrypted_payload: record.encrypted_payload,
          wrapped_session_key: record.wrapped_session_key,
          sentiment: record.sentiment,
          checksum: record.checksum,
          physics: record.physics,
          status: record.status,
          sent_at: record.sent_at
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/replay', async (req, res, next) => {
    try {
      const { message_id: messageId } = req.body || {};
      if (!messageId) {
        return res.status(400).json({ error: 'message_id_required' });
      }
      const archive = await findArchiveById(messageId);
      if (!archive) {
        return res.status(404).json({ error: 'not_found' });
      }
      if (archive.sender_id !== req.user?.sub && archive.receiver_id !== req.user?.sub) {
        return res.status(403).json({ error: 'forbidden' });
      }

      await Promise.all(
        archive.physics.map((state) =>
          socketHub.dispatchAsteroid({
            galaxyId: archive.galaxy_id,
            messageId,
            chunkIndex: state.chunkIndex,
            envelope: {
              physics: state,
              metadata: {
                sessionKeyWrapped: archive.wrapped_session_key,
                checksum: archive.checksum,
                sentiment: archive.sentiment,
                replay: true
              }
            }
          })
        )
      );

      res.json({ status: 'replayed', chunks: archive.physics.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
