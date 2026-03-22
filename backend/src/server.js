const app = require('./app');
const config = require('./config');
const logger = require('./services/logger');

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info('server_start', { port: PORT, env: config.nodeEnv });
});

// ───────────────────── Graceful Shutdown ─────────────────────

function gracefulShutdown(signal) {
  logger.info('shutdown_initiated', { signal });
  server.close(() => {
    logger.info('server_closed');
    process.exit(0);
  });
  // Force exit after 10 seconds if connections are still open
  setTimeout(() => {
    logger.error('shutdown_forced', { reason: 'timeout after 10s' });
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { error: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
