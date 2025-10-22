import { useEffect, useState } from 'react';
import { useSessionStore } from '../state/useSessionStore.js';
import { useMessageStore } from '../state/useMessageStore.js';

export default function MessageComposer() {
  const {
    user,
    galaxy,
    galaxies,
    refreshGalaxies,
    searchDirectory,
    directoryResults,
    clearDirectoryResults
  } = useSessionStore((state) => ({
    user: state.user,
    galaxy: state.galaxy,
    galaxies: state.galaxies,
    refreshGalaxies: state.refreshGalaxies,
    searchDirectory: state.searchDirectory,
    directoryResults: state.directoryResults,
    clearDirectoryResults: state.clearDirectoryResults
  }));
  const { sendMessage, sending, error } = useMessageStore();

  const [receiverId, setReceiverId] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [status, setStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    refreshGalaxies();
  }, [refreshGalaxies]);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearching(false);
      clearDirectoryResults();
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      await searchDirectory(searchTerm.trim());
      setSearching(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [searchTerm, searchDirectory, clearDirectoryResults]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('');
    if (!receiverId || !plaintext) {
      setStatus('Receiver and message required');
      return;
    }
    try {
      const res = await sendMessage({ receiver_id: receiverId, plaintext });
      setPlaintext('');
      setStatus(`Asteroid launch queued (${res.chunks} chunks)`);
    } catch (err) {
      setStatus(err.payload?.error || err.message || 'Transmission failed');
    }
  }

  function handleSelectPlanet(planet) {
    setReceiverId(planet.user_id);
    setSearchTerm(planet.username);
    setStatus(`Target set to ${planet.username}`);
    clearDirectoryResults();
  }

  return (
    <section className="panel composer-panel">
      <header>
        <h2>Launch Secure Asteroid</h2>
        <p>
          Logged in as <strong>{user?.username ?? 'anonymous'}</strong> orbiting galaxy{' '}
          <strong>{galaxy?.region ?? 'unknown'}</strong>.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="composer-form">
        <label>
          <span>Find Planet</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by callsign"
            autoComplete="off"
          />
        </label>

        {searchTerm.trim().length >= 2 && (
          <ul className="directory-list">
            {searching && <li className="muted">Scanning directory...</li>}
            {!searching && directoryResults.length === 0 && (
              <li className="muted">No planets matched that query.</li>
            )}
            {directoryResults.map((planet) => (
              <li key={planet.user_id}>
                <button type="button" onClick={() => handleSelectPlanet(planet)}>
                  <span className="dir-primary">{planet.username}</span>
                  <span className="dir-meta">
                    {planet.user_id.slice(0, 8)}... - {planet.region ?? 'unknown'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <label>
          <span>Receiver Planet ID</span>
          <input
            type="text"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            required
            placeholder="UUID of the receiver planet"
          />
        </label>

        <label className="composer-message">
          <span>Encrypted Payload Source</span>
          <textarea
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            minLength={1}
            maxLength={8192}
            required
            placeholder="Write your message. Physics will encode every chunk uniquely."
            rows={5}
          />
          <small>{plaintext.length} / 8192 characters</small>
        </label>

        <div className="composer-meta">
          <div>
            <span className="meta-label">Galaxies Online</span>
            <span className="meta-value">{galaxies.length}</span>
          </div>
          <div>
            <span className="meta-label">Current Region</span>
            <span className="meta-value">{galaxy?.region ?? 'n/a'}</span>
          </div>
        </div>

        <div className="composer-actions">
          <button type="submit" disabled={sending}>
            {sending ? 'Calculating Trajectory...' : 'Launch Asteroid'}
          </button>
          <button type="button" className="ghost" onClick={() => setPlaintext('')} disabled={sending}>
            Clear Payload
          </button>
        </div>
      </form>

      {(status || error) && <div className="composer-status">{status || error}</div>}
    </section>
  );
}
