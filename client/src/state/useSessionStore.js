import { create } from 'zustand';
import { apiPost, apiGet } from '../utils/api.js';
import { decryptPrivateKeyEnvelope, importPrivateKey } from '../utils/crypto.js';

const AUTH_STORAGE_KEY = 'universe-session';

function loadPersisted() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function persist(state) {
  if (typeof window === 'undefined') return;
  const snapshot = {
    token: state.token,
    user: state.user,
    galaxy: state.galaxy,
    privateKeyEnvelope: state.privateKeyEnvelope
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(snapshot));
}

export const useSessionStore = create((set, get) => ({
  token: null,
  user: null,
  galaxy: null,
  privateKeyEnvelope: null,
  unlockedPrivateKey: null,
  unlockedPrivateKeyPem: null,
  galaxies: [],
  directoryResults: [],
  status: 'idle',
  error: null,

  hydrate() {
    const data = loadPersisted();
    if (data?.token) {
      set({
        token: data.token,
        user: data.user,
        galaxy: data.galaxy,
        privateKeyEnvelope: data.privateKeyEnvelope,
        status: 'authenticated'
      });
    }
  },

  async register(payload) {
    set({ status: 'loading', error: null });
    try {
      const response = await apiPost('/users/register', payload);
      const nextState = {
        token: response.token,
        user: response.user,
        galaxy: response.galaxy,
        privateKeyEnvelope: response.private_key_encrypted,
        unlockedPrivateKey: null,
        unlockedPrivateKeyPem: null
      };
      set({ ...nextState, status: 'authenticated', error: null });
      persist(get());
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('token', response.token);
        window.localStorage.setItem('galaxyId', response.galaxy.galaxy_id);
      }
      return response;
    } catch (err) {
      set({ status: 'error', error: err.payload?.error || err.message });
      throw err;
    }
  },

  async login(payload) {
    set({ status: 'loading', error: null });
    try {
      const response = await apiPost('/users/login', payload);
      const nextState = {
        token: response.token,
        user: response.user,
        galaxy: response.galaxy,
        privateKeyEnvelope: response.private_key_encrypted,
        unlockedPrivateKey: null,
        unlockedPrivateKeyPem: null
      };
      set({ ...nextState, status: 'authenticated', error: null });
      persist(get());
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('token', response.token);
        if (response.galaxy?.galaxy_id) {
          window.localStorage.setItem('galaxyId', response.galaxy.galaxy_id);
        }
      }
      return response;
    } catch (err) {
      set({ status: 'error', error: err.payload?.error || err.message });
      throw err;
    }
  },

  logout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('galaxyId');
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    set({
      token: null,
      user: null,
      galaxy: null,
      privateKeyEnvelope: null,
      unlockedPrivateKey: null,
      unlockedPrivateKeyPem: null,
      galaxies: [],
      directoryResults: [],
      status: 'idle',
      error: null
    });
  },

  setPrivateKeyEnvelope(envelope) {
    set({
      privateKeyEnvelope: envelope,
      unlockedPrivateKey: null,
      unlockedPrivateKeyPem: null
    });
    persist(get());
  },

  async unlockPrivateKey(passphrase) {
    const envelope = get().privateKeyEnvelope;
    if (!envelope) {
      throw new Error('No encrypted key envelope available');
    }
    const pem = await decryptPrivateKeyEnvelope(envelope, passphrase);
    const cryptoKey = await importPrivateKey(pem);
    set({ unlockedPrivateKey: cryptoKey, unlockedPrivateKeyPem: pem });
    return { pem };
  },

  clearDirectoryResults() {
    set({ directoryResults: [] });
  },

  async refreshGalaxies() {
    const token = get().token;
    if (!token) return [];
    try {
      const data = await apiGet('/galaxies', token);
      set({ galaxies: data.galaxies ?? [] });
      return data.galaxies ?? [];
    } catch (err) {
      set({ error: err.payload?.error || err.message });
      return [];
    }
  },

  async searchDirectory(searchTerm) {
    const token = get().token;
    if (!token) {
      set({ directoryResults: [] });
      return [];
    }
    const query = searchTerm?.trim();
    if (!query) {
      set({ directoryResults: [] });
      return [];
    }
    try {
      const params = new URLSearchParams({ search: query, limit: '25' });
      const data = await apiGet(`/users/directory?${params.toString()}`, token);
      set({ directoryResults: data.users ?? [] });
      return data.users ?? [];
    } catch (err) {
      set({ error: err.payload?.error || err.message, directoryResults: [] });
      return [];
    }
  }
}));
