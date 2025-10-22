import jwt from 'jsonwebtoken';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';

export function issueAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var required');
  }
  const payload = {
    sub: user.user_id,
    username: user.username,
    galaxy_id: user.galaxy_id,
    region: user.region
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var required');
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}
