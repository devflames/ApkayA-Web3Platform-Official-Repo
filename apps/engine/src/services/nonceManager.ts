import type { Provider } from "ethers";

export interface NonceProvider {
  getTransactionCount(address: string, blockTag?: string): Promise<number>;
}

function walletKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Per-worker in-memory nonce allocator. Seeds from the chain's pending count
 * on first use, increments atomically per wallet, and reconciles periodically
 * (and on broadcast failure) against the chain.
 */
export class NonceManager {
  private readonly nextNonce = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();
  private reconcileTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly getProvider: (chainId: number) => NonceProvider,
    reconcileIntervalMs = Number(process.env.NONCE_RECONCILE_INTERVAL_MS ?? 30_000)
  ) {
    if (reconcileIntervalMs > 0) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcileAll();
      }, reconcileIntervalMs);
      this.reconcileTimer.unref?.();
    }
  }

  stop(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /** Reserves the next nonce for a wallet. Serialized per chain+address. */
  async acquireNonce(chainId: number, address: string): Promise<number> {
    const key = walletKey(chainId, address);
    return this.withLock(key, async () => {
      if (!this.nextNonce.has(key)) {
        const provider = this.getProvider(chainId);
        const pending = await provider.getTransactionCount(address, "pending");
        this.nextNonce.set(key, pending);
      }

      const nonce = this.nextNonce.get(key)!;
      this.nextNonce.set(key, nonce + 1);
      return nonce;
    });
  }

  /**
   * Returns a reserved nonce when broadcast failed before the tx entered the
   * mempool, so the same nonce can be reused.
   */
  releaseNonce(chainId: number, address: string): void {
    const key = walletKey(chainId, address);
    if (!this.nextNonce.has(key)) return;
    this.nextNonce.set(key, Math.max(0, this.nextNonce.get(key)! - 1));
  }

  /** Re-seeds local state from the chain if the node is ahead of our counter. */
  async reconcile(chainId: number, address: string): Promise<void> {
    const key = walletKey(chainId, address);
    const provider = this.getProvider(chainId);
    const chainPending = await provider.getTransactionCount(address, "pending");
    const local = this.nextNonce.get(key);

    if (local === undefined) {
      this.nextNonce.set(key, chainPending);
      return;
    }

    if (chainPending > local) {
      this.nextNonce.set(key, chainPending);
    }
  }

  private async reconcileAll(): Promise<void> {
    for (const key of this.nextNonce.keys()) {
      const [chainId, address] = key.split(":");
      await this.reconcile(Number(chainId), address);
    }
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const current = previous.then(() => gate);
    this.locks.set(
      key,
      current.catch(() => {})
    );

    try {
      await previous;
      return await fn();
    } finally {
      release();
    }
  }
}
