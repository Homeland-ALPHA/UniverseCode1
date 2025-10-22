import { useCallback } from 'react';
import { io } from 'socket.io-client';
import create from 'zustand';
import { useSessionStore } from '../state/useSessionStore.js';

const useSocketStore = create((set) => ({
  socket: null,
  events: [],
  pushEvent: (event) => set((state) => ({ events: [...state.events.slice(-255), event] })),
  setSocket: (socket) => set({ socket })
}));

export function useSocket() {
  const token = useSessionStore((state) => state.token);
  const logout = useSessionStore((state) => state.logout);
  const { socket, setSocket, pushEvent, events } = useSocketStore();

  const connect = useCallback(() => {
    if (socket || !token) return;
    const storedGalaxy = window.localStorage.getItem('galaxyId');
    const namespace = storedGalaxy ? `/galaxy-${storedGalaxy}` : '/';
    const instance = io(namespace, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: token ? { token } : undefined
    });

    instance.on('connect', () => {
      pushEvent({ type: 'system', message: 'Socket connected', ts: Date.now() });
    });

    instance.on('authorized', (payload) => {
      if (payload?.galaxyId) {
        window.localStorage.setItem('galaxyId', payload.galaxyId);
      }
      pushEvent({ type: 'system', message: 'Authorized for galaxy', payload, ts: Date.now() });
    });

    instance.on('connect_error', (err) => {
      pushEvent({ type: 'error', message: err.message, ts: Date.now() });
      if (err.message === 'unauthorized') {
        logout();
      }
    });

    instance.on('asteroidLaunch', (payload) => {
      pushEvent({ type: 'asteroid', payload, ts: Date.now() });
    });

    instance.on('disconnect', () => {
      pushEvent({ type: 'system', message: 'Socket disconnected', ts: Date.now() });
    });

    setSocket(instance);
  }, [socket, token, pushEvent, setSocket, logout]);

  const disconnect = useCallback(() => {
    const current = useSocketStore.getState().socket;
    if (current) {
      current.disconnect();
      setSocket(null);
    }
  }, [setSocket]);

  return { connect, disconnect, events };
}
