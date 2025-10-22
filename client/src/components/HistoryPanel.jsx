import { useEffect } from 'react';
import { useMessageStore } from '../state/useMessageStore.js';

export default function HistoryPanel() {
  const {
    history,
    loadHistory,
    replayMessage,
    decryptMessage,
    decrypting,
    activeMessage,
    clearActiveMessage,
    error
  } = useMessageStore((state) => ({
    history: state.history,
    loadHistory: state.loadHistory,
    replayMessage: state.replayMessage,
    decryptMessage: state.decryptMessage,
    decrypting: state.decrypting,
    activeMessage: state.activeMessage,
    clearActiveMessage: state.clearActiveMessage,
    error: state.error
  }));

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <section className="panel history-panel">
      <header>
        <h2>Encrypted Archives</h2>
        <p>Decrypt securely or replay the physics sequence for any recorded transmission.</p>
      </header>

      <ul className="history-list">
        {history.map((entry) => (
          <li key={entry.message_id}>
            <div>
              <span className="history-label">Message</span>
              <strong>{entry.message_id}</strong>
            </div>
            <div>
              <span className="history-label">Sent</span>
              <span>{new Date(entry.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="history-label">Sentiment</span>
              <span>{entry.sentiment?.label ?? 'neutral'}</span>
            </div>
            <div className="history-actions">
              <button type="button" onClick={() => replayMessage(entry.message_id)}>
                Replay Trajectory
              </button>
              <button
                type="button"
                className="ghost"
                disabled={decrypting}
                onClick={() => decryptMessage(entry.message_id)}
              >
                {decrypting ? 'Decrypting...' : 'Decrypt Payload'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {history.length === 0 && <p className="history-empty">No transmissions yet. Launch your first asteroid.</p>}
      {error && <p className="error-text">{error}</p>}

      {activeMessage && (
        <div className="decrypted-panel">
          <div className="decrypted-header">
            <div>
              <span className="history-label">Message</span>
              <strong>{activeMessage.messageId}</strong>
            </div>
            <button type="button" className="ghost" onClick={clearActiveMessage}>
              Clear
            </button>
          </div>
          <div className="decrypted-meta">
            <span>Sentiment: {activeMessage.sentiment}</span>
            <span>Sent: {activeMessage.sentAt ? new Date(activeMessage.sentAt).toLocaleString() : 'unknown'}</span>
            <span>Role: {activeMessage.isSender ? 'Sender' : 'Receiver'}</span>
          </div>
          <pre className="decrypted-text">{activeMessage.plaintext}</pre>
        </div>
      )}
    </section>
  );
}
