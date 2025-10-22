import { useState, useRef } from 'react';
import { useSessionStore } from '../state/useSessionStore.js';

export default function KeyManager() {
  const {
    user,
    privateKeyEnvelope,
    unlockedPrivateKey,
    setPrivateKeyEnvelope,
    unlockPrivateKey
  } = useSessionStore((state) => ({
    user: state.user,
    privateKeyEnvelope: state.privateKeyEnvelope,
    unlockedPrivateKey: state.unlockedPrivateKey,
    setPrivateKeyEnvelope: state.setPrivateKeyEnvelope,
    unlockPrivateKey: state.unlockPrivateKey
  }));
  const [status, setStatus] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const fileInputRef = useRef(null);

  function handleDownload() {
    if (!privateKeyEnvelope) {
      setStatus('No encrypted key is available yet. Register or login again to retrieve it.');
      return;
    }
    const filename = `${user?.username ?? 'universe'}-encrypted-key.json`;
    const blob = new Blob([JSON.stringify(privateKeyEnvelope, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus(`Encrypted key downloaded as ${filename}`);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      validateEnvelope(parsed);
      setPrivateKeyEnvelope(parsed);
      setStatus(`Encrypted key imported from ${file.name}`);
    } catch (err) {
      setStatus(`Failed to import key: ${err.message}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    try {
      const parsed = JSON.parse(event.clipboardData.getData('text'));
      validateEnvelope(parsed);
      setPrivateKeyEnvelope(parsed);
      setStatus('Encrypted key imported from clipboard');
    } catch (err) {
      setStatus(`Clipboard import failed: ${err.message}`);
    }
  }

  async function handleUnlock(event) {
    event.preventDefault();
    if (!passphrase.trim()) {
      setStatus('Passphrase required to unlock private key');
      return;
    }
    try {
      setUnlocking(true);
      await unlockPrivateKey(passphrase);
      setStatus('Private key unlocked for this session');
    } catch (err) {
      setStatus(err.message || 'Failed to unlock private key');
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="panel key-panel">
      <header>
        <h2>Private Key Vault</h2>
        <p>Download the encrypted RSA key for offline custody, then unlock it locally to decrypt payloads.</p>
      </header>

      <form className="key-actions" onSubmit={handleUnlock}>
        <button type="button" onClick={handleDownload}>Download Encrypted Key</button>
        <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
          Import from File
        </button>
        <input
          type="file"
          accept="application/json"
          ref={fileInputRef}
          onChange={handleFileChange}
          hidden
        />
        <button
          type="button"
          className="ghost"
          onClick={(event) => {
            event.currentTarget.focus();
            setStatus('Press Ctrl/Cmd+V now to paste your envelope');
          }}
          onPaste={handlePaste}
        >
          Paste JSON Envelope
        </button>
        <div className="key-unlock">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter key passphrase"
            minLength={4}
            required
          />
          <button type="submit" className="ghost" disabled={unlocking}>
            {unlocking ? 'Unlocking...' : 'Unlock for Session'}
          </button>
        </div>
      </form>

      <div className="key-meta">
        <div>
          <span className="meta-label">Callsign</span>
          <span className="meta-value">{user?.username ?? 'n/a'}</span>
        </div>
        <div>
          <span className="meta-label">Key Envelope</span>
          <span className="meta-value">{privateKeyEnvelope ? 'Available' : 'Missing'}</span>
        </div>
        <div>
          <span className="meta-label">Session Key</span>
          <span className="meta-value">{unlockedPrivateKey ? 'Unlocked' : 'Locked'}</span>
        </div>
      </div>

      {status && <div className="key-status">{status}</div>}
    </section>
  );
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Envelope must be a JSON object');
  }
  const requiredFields = ['algorithm', 'iv', 'salt', 'tag', 'payload'];
  const missing = requiredFields.filter((field) => !(field in envelope));
  if (missing.length) {
    throw new Error(`Missing fields: ${missing.join(', ')}`);
  }
}
