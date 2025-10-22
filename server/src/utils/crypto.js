import { randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync, pbkdf2Sync, createHash, publicEncrypt, privateDecrypt } from 'node:crypto';

const AES_ALGO = 'aes-256-gcm';
const PBKDF_ALGO = 'sha512';

export function generateRsaKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

export function encryptPrivateKey(privateKeyPem, passphrase) {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(passphrase, salt, 150000, 32, PBKDF_ALGO);
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: AES_ALGO,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    tag: tag.toString('base64'),
    payload: ciphertext.toString('base64')
  };
}

export function decryptPrivateKey(encrypted, passphrase) {
  const salt = Buffer.from(encrypted.salt, 'base64');
  const key = pbkdf2Sync(passphrase, salt, 150000, 32, PBKDF_ALGO);
  const decipher = createDecipheriv(AES_ALGO, key, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.payload, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

export function generateSessionKey() {
  return randomBytes(32).toString('base64');
}

export function wrapSessionKeyWithRsa(publicKeyPem, sessionKeyBase64) {
  const buffer = Buffer.from(sessionKeyBase64, 'base64');
  const encrypted = publicEncrypt({ key: publicKeyPem, oaepHash: 'sha256' }, buffer);
  return encrypted.toString('base64');
}

export function unwrapSessionKeyWithRsa(privateKeyPem, wrappedKeyBase64) {
  const decrypted = privateDecrypt({ key: privateKeyPem, oaepHash: 'sha256' }, Buffer.from(wrappedKeyBase64, 'base64'));
  return decrypted.toString('base64');
}

export function encryptMessage(sessionKeyBase64, plaintext, aad = '') {
  const key = Buffer.from(sessionKeyBase64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    payload: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
    algorithm: AES_ALGO
  };
}

export function decryptMessage(sessionKeyBase64, envelope, aad = '') {
  const key = Buffer.from(sessionKeyBase64, 'base64');
  const decipher = createDecipheriv(AES_ALGO, key, Buffer.from(envelope.iv, 'base64'));
  if (aad) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.payload, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

export function computeChecksum(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}
