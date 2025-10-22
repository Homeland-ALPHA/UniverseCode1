import { useSessionStore } from '../state/useSessionStore.js';

export default function HeaderBar() {
  const { user, galaxy, logout } = useSessionStore();

  return (
    <header className="app-header">
      <div>
        <h1>Universe Code</h1>
        <p>Military-grade quantum-resistant courier with astrophysical camouflage.</p>
      </div>
      {user && (
        <div className="header-status">
          <div>
            <span className="status-label">Callsign</span>
            <span className="status-value">{user.username}</span>
          </div>
          <div>
            <span className="status-label">Galaxy</span>
            <span className="status-value">{galaxy?.galaxy_id.slice(0, 8)}...</span>
          </div>
          <button type="button" onClick={logout} className="ghost">
            Secure Logout
          </button>
        </div>
      )}
    </header>
  );
}
