# Asteroid-Planet Physics Encoding Rules

## Overview
Universe Code models each encrypted message chunk as an asteroid traveling through a galaxy and colliding with a target planet. The full message is reconstructed by replaying the physics simulation deterministically on both sender and receiver nodes. Every physical parameter is derived from cryptographic primitives so that tampering breaks the simulation and interceptors without keys cannot reproduce the correct states.

## Coordinate System
- **Galaxy Frame**: Right-handed 3D Cartesian coordinates (x, y, z) centered on the galaxy's barycenter.
- **Planet Orbit Plane**: Each planet (user) has an orbital plane inclination i and orbit radius  computed from the user's static seed.
- **Time Base**: Discrete timesteps ?t = 16 ms (60 FPS) for visualization, but physics integration uses adaptive Runge-Kutta with tolerance 1e-6 to ensure determinism.

## Parameter Derivation Pipeline
1. **Message Chunking**
   - Plaintext is AES-256-GCM encrypted using a session key derived from the sender's private key and receiver's public key (ECDH or RSA hybrid).
   - The ciphertext is chunked into 192-bit blocks (matching 64 base64 characters) to minimize rounding sensitivity.
2. **Hash Lattice**
   - For each chunk C_i, compute H_i = SHA-512(galaxyNonce || senderId || receiverId || C_i || i).
   - Split H_i into 8?64-bit lanes: [h0, h1, ..., h7].
3. **Physical Parameters**
   - **Asteroid Mass** m_i = m_base + (h0 mod m_span) where m_base = 2e12 kg, m_span = 8e11 kg.
   - **Velocity Vector**
     - Magnitude |v_i| = v_min + (h1 mod v_span) with _min = 9 km/s, _span = 6 km/s.
     - Approach angles derived via normalized quaternions from [h2, h3].
   - **Spin Tensor** ?_i from h4 mapped to rotational axis and RPM (range 0.2?3.0 rev/s).
   - **Impact Point** P_i: perturbation on receiver orbit governed by h5 projected onto tangent plane; ensures collisions distribute across surface.
   - **Material Composition** ?_i from h6 determines visual particle effect and post-impact energy dispersion.
   - **Energy Signature** E_i = 0.5 * m_i * |v_i|^2, checkpointed for verification.
4. **Deterministic Noise**
   - Micro-perturbations applied via Perlin(hash=h7) with amplitude <= 3% to avoid visual repetition while remaining reproducible.

## Simulation Rules
- Integrate asteroid trajectory from sender planet's L1 point to receiver atmosphere using leapfrog integration corrected with RK4 to avoid drift.
- Collisions use Hertzian contact mechanics to compute impulse; the impulse scalar quantized to 256 levels representing cipher chunk order to guard against replays.
- Post-impact fragment trajectories determine message indexes; receiver replays simulation and matches fragment cluster IDs against expected order.

## Authentication Coupling
- Each simulation step emits a state commitment S_i = SHA-256(position || velocity || timestep); the final commitment must match the value transmitted alongside metadata.
- Any deviation in transit causes mismatch and triggers re-request.

## Tamper Resistance
- Without the shared keys, interceptors see only high-entropy metadata. Reconstructing plaintext would require brute-forcing initial hash lanes, equating to breaking AES-GCM or SHA-512.
- Altering physics values invalidates S_i commitments and checksum checksum = HMAC-SHA3(sessionKey, ? E_i || ? ?_i).

## Visualization Mapping
- Color derived from sentiment analysis when available; fallback uses ?_i.
- Impact crater size proportionate to E_i, but capped to protect visual readability.

## Determinism Guarantees
- All floating calculations use 64-bit floats with deterministic math libraries (gl-matrix + wasm fallback).
- Random number generation uses ChaCha20 seeded with H_i to ensure cross-platform synchronicity.

