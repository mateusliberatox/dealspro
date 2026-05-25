import 'dotenv/config';
import http from 'node:http';
import { startMonitor, getHealthStatus } from '../jobs/monitor.js';
import { logger } from '../utils/logger.js';

// Railway injeta PORT automaticamente; fallback para 3000 em desenvolvimento
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const health = getHealthStatus();
    const code   = health.status === 'ok' ? 200 : 503;
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT} — GET /health`);
});

startMonitor();
