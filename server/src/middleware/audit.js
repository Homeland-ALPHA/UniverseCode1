import { randomUUID } from 'node:crypto';

export function auditLogger(req, res, next) {
  const start = Date.now();
  const auditId = randomUUID();
  res.setHeader('x-audit-id', auditId);
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user?.sub ?? 'anonymous';
    const safePath = req.originalUrl.split('?')[0];
    console.log(
      `[Audit:${auditId}] ${req.method} ${safePath} status=${res.statusCode} user=${user} ip=${req.ip} duration=${duration}ms`
    );
  });
  next();
}
