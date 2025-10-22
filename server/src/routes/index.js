import userRoutes from './user.js';
import messageRoutes from './message.js';
import galaxyRoutes from './galaxy.js';
import { requireAuth } from '../middleware/auth.js';
import { auditLogger } from '../middleware/audit.js';

export default function registerRestRoutes(app, deps) {
  app.use('/api', auditLogger);

  app.use('/api/users', userRoutes(deps));
  app.use('/api/messages', requireAuth, messageRoutes(deps));
  app.use('/api/galaxies', requireAuth, galaxyRoutes());

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
}
