import { create } from 'zustand';
import { apiGet, apiPost } from '../utils/api.js';
import { useSessionStore } from './useSessionStore.js';
import { unwrapSessionKey, decryptMessageEnvelope } from '../utils/crypto.js';

export const useMessageStore = create((set, get) => ({
  history: [],
  sending: false,
  decrypting: false,
  error: null,
  activeMessage: null,

  async loadHistory() {
    const token = useSessionStore.getState().token;
    if (!token) return [];
    try {
      const data = await apiGet('/messages/history', token);
      set({ history: data.history ?? [], error: null });
      return data.history ?? [];
    } catch (err) {
      set({ error: err.payload?.error || err.message });
      return [];
    }
  },

  async sendMessage(payload) {
    const token = useSessionStore.getState().token;
    if (!token) throw new Error('Not authenticated');
    set({ sending: true, error: null });
    try {
      const res = await apiPost('/messages/send', payload, token);
      await get().loadHistory();
      set({ sending: false });
      return res;
    } catch (err) {
      set({ sending: false, error: err.payload?.error || err.message });
      throw err;
    }
  },

  async replayMessage(messageId) {
    const token = useSessionStore.getState().token;
    if (!token) throw new Error('Not authenticated');
    try {
      await apiPost('/messages/replay', { message_id: messageId }, token);
    } catch (err) {
      set({ error: err.payload?.error || err.message });
      throw err;
    }
  },

  async decryptMessage(messageId) {
    const { token, unlockedPrivateKey, user } = useSessionStore.getState();
    if (!token) throw new Error('Not authenticated');
    if (!unlockedPrivateKey) {
      throw new Error('Unlock your private key first');
    }
    set({ decrypting: true, error: null });
    try {
      const detail = await apiGet(`/messages/${messageId}`, token);
      const message = detail.message;
      if (!message) throw new Error('Message payload missing');

      const sessionKeyBytes = await unwrapSessionKey(unlockedPrivateKey, message.wrapped_session_key);
      const aad = `${message.sender_id}->${message.receiver_id}`;
      const plaintext = await decryptMessageEnvelope(sessionKeyBytes, message.encrypted_payload, aad);

      set({
        decrypting: false,
        activeMessage: {
          messageId,
          plaintext,
          sentiment: message.sentiment?.label ?? 'neutral',
          sentAt: message.sent_at,
          sender: message.sender_id,
          receiver: message.receiver_id,
          checksum: message.checksum,
          isSender: message.sender_id === user?.user_id
        }
      });
      return plaintext;
    } catch (err) {
      set({ decrypting: false, error: err.payload?.error || err.message });
      throw err;
    }
  },

  clearActiveMessage() {
    set({ activeMessage: null });
  }
}));
