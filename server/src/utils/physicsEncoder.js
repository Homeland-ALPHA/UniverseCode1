import { createHash } from 'node:crypto';

const MASS_BASE = 2_000_000_000_000n;
const MASS_SPAN = 800_000_000_000n;
const VELOCITY_MIN = 9_000; // m/s
const VELOCITY_SPAN = 6_000; // m/s
const RPM_MIN = 0.2;
const RPM_MAX = 3.0;

function lane(hash, index) {
  const start = index * 8;
  return hash.subarray(start, start + 8).readBigUInt64BE();
}

function normalise(vec) {
  const magnitude = Math.hypot(vec[0], vec[1], vec[2]);
  if (magnitude === 0) {
    return [1, 0, 0];
  }
  return vec.map((c) => c / magnitude);
}

export function derivePhysicsState({ galaxyNonce, senderId, receiverId, chunkIndex, chunkCiphertext, extras = {} }) {
  if (!galaxyNonce || !senderId || !receiverId) {
    throw new Error('Physics state derivation requires galaxyNonce, senderId, receiverId');
  }

  const hash = createHash('sha512')
    .update(galaxyNonce)
    .update(senderId)
    .update(receiverId)
    .update(chunkCiphertext)
    .update(Buffer.from(String(chunkIndex)))
    .digest();

  const h0 = lane(hash, 0);
  const h1 = lane(hash, 1);
  const h2 = lane(hash, 2);
  const h3 = lane(hash, 3);
  const h4 = lane(hash, 4);
  const h5 = lane(hash, 5);
  const h6 = lane(hash, 6);
  const h7 = lane(hash, 7);

  const mass = Number(MASS_BASE + (h0 % MASS_SPAN));
  const velocityMagnitude = VELOCITY_MIN + Number(h1 % BigInt(VELOCITY_SPAN));

  const orientationSeed = [h2, h3, h2 ^ h3].map((value) => Number(value % 10_000n) / 10_000);
  const [ox, oy, oz] = normalise([
    orientationSeed[0] * 2 - 1,
    orientationSeed[1] * 2 - 1,
    orientationSeed[2] * 2 - 1
  ]);

  const spinRatio = Number(h4 % 10_000n) / 10_000;
  const spinRpm = RPM_MIN + spinRatio * (RPM_MAX - RPM_MIN);

  const impactOffset = [
    Number((h5 >> 32n) & 0xffffffffn) / 0xffffffff,
    Number(h5 & 0xffffffffn) / 0xffffffff
  ].map((v) => v * 2 - 1);

  const compositionCode = Number(h6 % 5n);
  const noiseScalar = Number(h7 % 3_000n) / 100_000;

  return {
    chunkIndex,
    mass,
    velocity: {
      magnitude: velocityMagnitude,
      direction: { x: ox, y: oy, z: oz }
    },
    spin: {
      rpm: spinRpm,
      axis: { x: oy, y: oz, z: ox }
    },
    impact: {
      surfaceOffset: { u: impactOffset[0], v: impactOffset[1] },
      energy: 0.5 * mass * velocityMagnitude ** 2
    },
    compositionCode,
    noiseScalar,
    visual: {
      color: extras.color,
      sentiment: extras.sentimentLabel
    }
  };
}
