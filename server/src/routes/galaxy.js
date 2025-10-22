import { Router } from 'express';
import { listGalaxies } from '../models/galaxies.js';

export default function galaxyRoutes() {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const galaxies = await listGalaxies();
      res.json({ galaxies });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
