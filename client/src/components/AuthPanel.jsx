import { useEffect, useState } from 'react';
import { useSessionStore } from '../state/useSessionStore.js';

const MODE_LOGIN = 'login';
const MODE_REGISTER = 'register';

export default function AuthPanel() {
  const { status, error, login, register } = useSessionStore();
  const [mode, setMode] = useState(MODE_LOGIN);
  const [form, setForm] = useState({
    username: '',
    password: '',
    keyPassphrase: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (error) {
      setMessage(error);
    }
  }, [error]);

  const isRegister = mode === MODE_REGISTER;
  const loading = status === 'loading';

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (isRegister) {
        await register({
          username: form.username,
          password: form.password,
          keyPassphrase: form.keyPassphrase
        });
        setMessage('Registration complete. Connected to galaxy.');
      } else {
        await login({
          username: form.username,
          password: form.password
        });
        setMessage('Authentication successful.');
      }
    } catch (err) {
      setMessage(err.payload?.error || err.message || 'Authentication failed');
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <section className="panel auth-panel">
      <header>
        <h2>{isRegister ? 'Secure Registration' : 'Access Universe Code'}</h2>
        <p>
          {isRegister
            ? 'Provision a hardened account with RSA keypair and galaxy assignment.'
            : 'Authenticate to enter your assigned galaxy and decrypt incoming asteroids.'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          <span>Callsign</span>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            minLength={3}
            maxLength={32}
            required
            autoComplete="username"
            placeholder="e.g. nebula-sentinel"
          />
        </label>

        <label>
          <span>Passphrase</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            minLength={12}
            maxLength={128}
            required
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Min 12 characters"
          />
        </label>

        {isRegister && (
          <label>
            <span>Key Vault Secret</span>
            <input
              type="password"
              name="keyPassphrase"
              value={form.keyPassphrase}
              onChange={handleChange}
              minLength={16}
              required
              placeholder="Used to encrypt your private key"
            />
          </label>
        )}

        <div className="auth-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Create Secure Planet' : 'Enter Galaxy'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setMode(isRegister ? MODE_LOGIN : MODE_REGISTER);
              setMessage('');
            }}
          >
            {isRegister ? 'Have credentials? Sign in' : 'Need access? Register'}
          </button>
        </div>
      </form>

      {message && <div className="auth-message">{message}</div>}
    </section>
  );
}
