const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToUint8Array(value) {
  const cleaned = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}

function concatUint8Arrays(a, b) {
  const merged = new Uint8Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

export async function decryptPrivateKeyEnvelope(envelope, passphrase) {
  if (!envelope) {
    throw new Error('Encrypted private key not available');
  }
  const salt = base64ToUint8Array(envelope.salt);
  const iv = base64ToUint8Array(envelope.iv);
  const payload = base64ToUint8Array(envelope.payload);
  const tag = base64ToUint8Array(envelope.tag);
  const combined = concatUint8Arrays(payload, tag);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150000,
      hash: 'SHA-512'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode('universe-code-key')
    },
    derivedKey,
    combined
  ).catch(async (error) => {
    // Retry without additional data if legacy envelope
    if (error instanceof DOMException) {
      return window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        combined
      );
    }
    throw error;
  });

  return decoder.decode(plaintext);
}

export async function importPrivateKey(pem) {
  const pemBody = pem.replace(/-----BEGIN ([\w\s]+)-----/, '').replace(/-----END ([\w\s]+)-----/, '').replace(/\s+/g, '');
  const binary = base64ToUint8Array(pemBody);
  return window.crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

export async function unwrapSessionKey(privateKey, wrappedBase64) {
  const wrapped = base64ToUint8Array(wrappedBase64);
  const sessionBuffer = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    wrapped
  );
  return new Uint8Array(sessionBuffer);
}

export async function decryptMessageEnvelope(sessionKeyBytes, envelope, aadString = '') {
  const key = await window.crypto.subtle.importKey(
    'raw',
    sessionKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = base64ToUint8Array(envelope.iv);
  const payload = base64ToUint8Array(envelope.payload);
  const tag = base64ToUint8Array(envelope.tag);
  const combined = concatUint8Arrays(payload, tag);
  const additionalData = aadString ? encoder.encode(aadString) : undefined;

  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData
    },
    key,
    combined
  );
  return decoder.decode(plaintext);
}

export { base64ToUint8Array, uint8ArrayToBase64 };
