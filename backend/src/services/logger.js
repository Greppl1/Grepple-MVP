/**
 * Structured logger for the backend.
 * Outputs JSON lines with timestamp, level, message, and optional context.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function log(level, message, context = {}) {
  if (LEVELS[level] > LOG_LEVEL) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };

  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(output);
  } else {
    console.log(output);
  }
}

const logger = {
  error: (msg, ctx) => log('error', msg, ctx),
  warn: (msg, ctx) => log('warn', msg, ctx),
  info: (msg, ctx) => log('info', msg, ctx),
  debug: (msg, ctx) => log('debug', msg, ctx),

  /** Log a blockchain transaction attempt */
  tx: (action, details) =>
    log('info', `tx:${action}`, {
      tx_hash: details.hash || null,
      to: details.to || null,
      ...details,
    }),
};

module.exports = logger;
