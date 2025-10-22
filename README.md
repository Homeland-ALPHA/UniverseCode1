# Universe Code

Universe Code is a secure, physics-inspired messaging platform where every encrypted payload is visualized as an asteroid traveling across galaxies of users. Messages are protected with hybrid RSA/AES encryption, encoded into deterministic physics states, and rendered in real time with Socket.IO and Three.js.

## Architecture

- **Backend**: Node.js (Express, Socket.IO) with Redis for signaling, MongoDB for persistence, and RSA/AES crypto utilities.
- **Frontend**: React + Vite + Three.js for visualizing galaxies and asteroid impacts.
- **Data stores**: MongoDB (users/messages/archives), Redis (pub/sub adapter).

## Key Features

- Secure registration and login with RSA keypair generation and encrypted private key storage.
- Physics-based message chunk encoding; every chunk maps to an asteroid trajectory.
- Socket.IO clusters per "galaxy" with replay support and audit logging.
- Web client features: galaxy browser, encrypted key vault, live asteroid visualization, planet directory search, and client-side decryption of message payloads once the user unlocks their key.

## Getting Started

1. **Install dependencies**
   `ash
   cd server && npm install
   cd ../client && npm install
   `
2. **Configure environment**
   Copy server/.env.example to .env and set MONGO_URI, REDIS_URL, JWT_SECRET, etc.

3. **Run smoke test**
   `ash
   cd server
   npm run smoke
   `
   This spins up in-memory Mongo/Redis instances and exercises register → send → fetch → replay.

4. **Start services**
   - Backend: 
pm run dev inside server
   - Frontend: 
pm run dev inside client

## Decryption Workflow

1. Log in (or register) and download your encrypted private key envelope.
2. Import the envelope on any device and unlock it with your passphrase.
3. Open the archives panel, select a message, and click "Decrypt Payload". The client unwraps the session key using Web Crypto APIs and decrypts the AES-GCM payload locally.

## Security Notes

- RSA wrapping uses OAEP/SHA-256 to interoperate with Web Crypto.
- Encrypted private keys use AES-256-GCM with PBKDF2 (150k iterations, SHA-512).
- REST APIs are protected by JWTs, helmet CSP, rate limits, and audit logging.

## Future Enhancements

- Delivery acknowledgements and inbox filtering.
- Key rotation and hardware-backed key options.
- Bundle size optimization and production deployment scripts.

## License

Proprietary – all rights reserved.
