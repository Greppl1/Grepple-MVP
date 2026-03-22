/**
 * Transaction queue — serializes contract write calls to prevent nonce conflicts.
 * Wraps tx.wait() with timeout + retry on transient wait failures (NOT re-sending the TX).
 */

const logger = require('./logger');

const TX_TIMEOUT_MS = 60_000; // 60 seconds
const MAX_WAIT_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

class TxQueue {
  constructor() {
    this._queue = Promise.resolve();
  }

  /**
   * Enqueue a contract write operation.
   * The callback should return a ContractTransactionResponse.
   * The TX is sent ONCE. Only the wait (confirmation) is retried on transient failures.
   */
  async enqueue(fn) {
    const task = this._queue.then(async () => {
      // Send the transaction exactly once
      const tx = await fn();
      // Wait for confirmation with retry (does NOT re-send)
      return this._waitWithRetry(tx);
    });

    // Chain but don't let failures cascade to next queued item
    this._queue = task.catch(() => {});

    return task;
  }

  async _waitWithRetry(tx, retries = MAX_WAIT_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this._waitWithTimeout(tx);
      } catch (err) {
        const isRetryable =
          err.message?.includes('timeout') ||
          err.code === 'NETWORK_ERROR' ||
          err.code === 'SERVER_ERROR';

        if (attempt === retries || !isRetryable) throw err;

        logger.warn('tx_wait_retry', {
          attempt,
          max_retries: retries,
          tx_hash: tx.hash,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  async _waitWithTimeout(tx) {
    let timer;
    try {
      return await Promise.race([
        tx.wait(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Transaction timeout after ${TX_TIMEOUT_MS}ms: ${tx.hash}`)),
            TX_TIMEOUT_MS
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

// Singleton instance
const txQueue = new TxQueue();

module.exports = txQueue;
