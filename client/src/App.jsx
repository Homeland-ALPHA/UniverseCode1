import { useEffect } from 'react';
import HeaderBar from './components/HeaderBar.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import UniverseMap from './components/UniverseMap.jsx';
import KeyManager from './components/KeyManager.jsx';
import MessageComposer from './components/MessageComposer.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import ThreeScene from './components/ThreeScene.jsx';
import MessageCollision from './components/MessageCollision.jsx';
import { useSessionStore } from './state/useSessionStore.js';
import { useSocket } from './hooks/useSocket.js';

export default function App() {
  const { token, user, hydrate, status } = useSessionStore();
  const { connect, disconnect, events } = useSocket();
  const authenticated = Boolean(token && user);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (authenticated) {
      connect();
      return () => disconnect();
    }
    disconnect();
    return undefined;
  }, [authenticated, connect, disconnect]);

  return (
    <div className="app-root">
      <HeaderBar />
      {authenticated ? (
        <div className="app-shell">
          <aside className="sidebar">
            <UniverseMap />
            <KeyManager />
            <MessageComposer />
            <HistoryPanel />
          </aside>
          <main className="stage">
            <ThreeScene events={events} />
            <MessageCollision events={events} />
          </main>
        </div>
      ) : (
        <div className="unauth-shell">
          <div className="unauth-panel">
            <AuthPanel />
            {status === 'loading' && <p className="loading-text">Provisioning galaxy...</p>}
          </div>
          <div className="unauth-visual">
            <ThreeScene events={[]} />
          </div>
        </div>
      )}
    </div>
  );
}
