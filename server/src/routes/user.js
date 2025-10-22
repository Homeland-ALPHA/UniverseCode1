import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { generateRsaKeyPair, encryptPrivateKey } from '../utils/crypto.js';
import { createUser, findUserByUsername, searchUsersDirectory } from '../models/users.js';
import { issueAccessToken } from '../services/tokenService.js';
import { requireAuth } from '../middleware/auth.js';

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).required(),
  password: Joi.string().min(12).max(128).required(),
  keyPassphrase: Joi.string().min(16).required()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const directoryLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

export default function userRoutes({ galaxyManager }) {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const { value, error } = registerSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const existing = await findUserByUsername(value.username);
      if (existing) {
        return res.status(409).json({ error: 'username_taken' });
      }

      const passwordHash = await bcrypt.hash(value.password, 12);
      const { publicKey, privateKey } = generateRsaKeyPair();
      const encryptedPrivateKey = encryptPrivateKey(privateKey, value.keyPassphrase);

      const galaxyAssignment = await galaxyManager.assignGalaxyForUser();

      const userId = uuid();
      const doc = {
        user_id: userId,
        username: value.username,
        password_hash: passwordHash,
        public_key: publicKey,
        private_key_encrypted: encryptedPrivateKey,
        galaxy_id: galaxyAssignment.galaxy_id,
        region: galaxyAssignment.region,
        coords: galaxyAssignment.coords,
        mass: galaxyAssignment.mass,
        orbit_zone: galaxyAssignment.orbit_zone
      };

      await createUser(doc);

      const token = issueAccessToken(doc);

      res.status(201).json({
        token,
        user: {
          user_id: userId,
          username: value.username,
          public_key: publicKey,
          galaxy_id: galaxyAssignment.galaxy_id,
          region: galaxyAssignment.region,
          coords: galaxyAssignment.coords
        },
        galaxy: galaxyAssignment,
        private_key_encrypted: encryptedPrivateKey
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { value, error } = loginSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const user = await findUserByUsername(value.username);
      if (!user) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }

      const passwordOk = await bcrypt.compare(value.password, user.password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }

      const token = issueAccessToken(user);
      const galaxy = galaxyManager.getGalaxy(user.galaxy_id) ?? { galaxy_id: user.galaxy_id };

      res.json({
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          public_key: user.public_key,
          galaxy_id: user.galaxy_id,
          region: user.region,
          coords: user.coords
        },
        galaxy,
        private_key_encrypted: user.private_key_encrypted
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/directory', requireAuth, directoryLimiter, async (req, res, next) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 25;
      const users = await searchUsersDirectory({ search, limit: Number.isNaN(limit) ? 25 : limit });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
