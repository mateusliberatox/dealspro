import 'dotenv/config';
import { startMonitor } from './jobs/monitor.js';
import { logger } from './utils/logger.js';

logger.info('DealsPro starting...');
startMonitor().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
