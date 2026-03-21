/**
 * Transaction queue — serializes contract write calls to prevent nonce conflicts.
 * Wraps tx.wait() with a configurable timeout.
 */

const TX_TIMEOUT_MS = 60_000; // 60 seconds

class TxQueue {
  constructor() {
    this._queue = Promise.resolve();
  }

  /**
   * Enqueue a contract write operation. The callback should return a
   * ContractTransactionResponse (the result of calling a contract method).
   * Returns the transaction receipt.
   */
  async enqueue(fn) {
    const task = this._queue.then(async () => {
      const tx = await fn();
      return this._waitWithTimeout(tx);
    });

    // Chain but don't let failures cascade to next queued item
    this._queue = task.catch(() => {});

    return task;
  }

  async _waitWithTimeout(tx) {
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Transaction timeout after ${TX_TIMEOUT_MS}ms: ${tx.hash}`)), TX_TIMEOUT_MS)
      ),
    ]);
    return receipt;
  }
}

// Singleton instance
const txQueue = new TxQueue();

module.exports = txQueue;
