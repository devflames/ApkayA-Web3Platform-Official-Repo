/**
 * @apkaya/sdk — a minimal typed client for the Engine API.
 *
 * Usage:
 *   const client = new ApkayaClient({ baseUrl: "http://localhost:3005", apiKey: "..." });
 *   const wallet = await client.wallets.create("checkout-wallet");
 *   const tx = await client.transactions.send({ chainId: 80002, fromWalletId: wallet.id, toAddress, valueWei: "0" });
 *   const status = await client.transactions.status(tx.id);
 */

export interface ApkayaClientOptions {
  baseUrl: string;
  apiKey: string;
}

export interface BackendWallet {
  id: string;
  label: string;
  address: string;
  key_type: string;
  created_at: string;
  is_active: number;
}

export interface TransactionRecord {
  id: string;
  chain_id: number;
  from_wallet_id: string;
  to_address: string;
  status: "queued" | "sent" | "mined" | "reverted" | "errored" | "cancelled";
  tx_hash: string | null;
  [key: string]: unknown;
}

export interface ApiKeyRecord {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: number;
  rate_limit_per_minute: number | null;
}

export interface CreatedApiKey extends ApiKeyRecord {
  /** Only present on creation — Engine stores just the hash and cannot show this again. */
  key: string;
}

export interface SendTransactionInput {
  chainId: number;
  fromWalletId: string;
  toAddress: string;
  data?: string;
  valueWei?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface DeployedContract {
  id: string;
  chain_id: number;
  address: string;
  name: string;
  abi_json: string;
  deployer_wallet_id: string | null;
  deployed_at: string;
  tx_id: string | null;
}

export interface ContractFunctionInfo {
  name: string;
  stateMutability: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
}

export interface ContractDetail extends Omit<DeployedContract, "abi_json"> {
  abi: unknown[];
  functions: ContractFunctionInfo[];
}

export interface RegisterContractInput {
  chainId: number;
  address: string;
  name: string;
  abi: unknown[];
  deployerWalletId?: string;
  txId?: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class ApkayaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: ApkayaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers ?? {}),
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new HttpError(res.status, (body as { error?: string }).error ?? res.statusText);
    }

    return (body as { result: T }).result;
  }

  wallets = {
    create: (label: string) =>
      this.request<BackendWallet>("/backend-wallet/create", {
        method: "POST",
        body: JSON.stringify({ label }),
      }),

    list: () => this.request<BackendWallet[]>("/backend-wallet"),

    get: (id: string) => this.request<BackendWallet>(`/backend-wallet/${id}`),

    balance: (id: string, chainId: number) =>
      this.request<{ address: string; chainId: number; balanceWei: string }>(
        `/backend-wallet/${id}/balance?chainId=${chainId}`
      ),
  };

  transactions = {
    send: (input: SendTransactionInput) =>
      this.request<TransactionRecord>("/transaction/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    status: (id: string) => this.request<TransactionRecord>(`/transaction/status/${id}`),

    list: (filters?: { status?: string; walletId?: string; chainId?: number; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.walletId) params.set("walletId", filters.walletId);
      if (filters?.chainId) params.set("chainId", String(filters.chainId));
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      return this.request<TransactionRecord[]>(`/transaction${qs ? `?${qs}` : ""}`);
    },

    cancel: (id: string) =>
      this.request<{ id: string; status: string }>(`/transaction/cancel/${id}`, { method: "POST" }),

    /** Polls /status until the tx leaves the "queued"/"sent" states, or timeoutMs elapses. */
    waitForMined: async (id: string, { timeoutMs = 120_000, intervalMs = 2000 } = {}) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const tx = await this.transactions.status(id);
        if (["mined", "reverted", "errored", "cancelled"].includes(tx.status)) return tx;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new Error(`Timed out waiting for transaction ${id} to be mined`);
    },
  };

  chains = {
    list: () => this.request<Array<{ chainId: number; name: string; rpcUrl: string }>>("/chain"),
  };

  contracts = {
    register: (input: RegisterContractInput) =>
      this.request<DeployedContract>("/contract/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    list: (filters?: { chainId?: number; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.chainId) params.set("chainId", String(filters.chainId));
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      return this.request<DeployedContract[]>(`/contract${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => this.request<ContractDetail>(`/contract/${id}`),

    read: (id: string, functionName: string, args: unknown[] = []) =>
      this.request<{ value: unknown }>(`/contract/${id}/read`, {
        method: "POST",
        body: JSON.stringify({ functionName, args }),
      }),

    write: (
      id: string,
      input: {
        fromWalletId: string;
        functionName: string;
        args?: unknown[];
        valueWei?: string;
        idempotencyKey?: string;
        metadata?: Record<string, unknown>;
      }
    ) =>
      this.request<TransactionRecord>(`/contract/${id}/write`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  /**
   * Key management — requires the client to be configured with Engine's
   * ENGINE_ADMIN_KEY, not a regular customer key. Use a separate
   * ApkayaClient instance for this if your app also makes regular
   * wallet/transaction calls with a customer key.
   */
  apiKeys = {
    create: (label: string, options?: { rateLimitPerMinute?: number }) =>
      this.request<CreatedApiKey>("/api-key/create", {
        method: "POST",
        body: JSON.stringify({ label, rateLimitPerMinute: options?.rateLimitPerMinute }),
      }),

    list: () => this.request<ApiKeyRecord[]>("/api-key"),

    get: (id: string) => this.request<ApiKeyRecord>(`/api-key/${id}`),

    revoke: (id: string) =>
      this.request<{ id: string; is_active: boolean }>(`/api-key/${id}/revoke`, { method: "POST" }),

    reactivate: (id: string) =>
      this.request<{ id: string; is_active: boolean }>(`/api-key/${id}/reactivate`, { method: "POST" }),

    setRateLimit: (id: string, rateLimitPerMinute: number | null) =>
      this.request<{ id: string; rate_limit_per_minute: number | null }>(`/api-key/${id}/rate-limit`, {
        method: "POST",
        body: JSON.stringify({ rateLimitPerMinute }),
      }),
  };

  auth = {
    siweNonce: (input: {
      address: string;
      chainId: number;
      domain: string;
      uri: string;
      statement?: string;
    }) =>
      this.request<{ nonce: string; message: string; expiresAt: string }>("/auth/siwe/nonce", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    siweVerify: (input: { message: string; signature: string }) =>
      this.request<{
        sessionToken: string;
        expiresAt: string;
        address: string;
        authMethod: string;
        endUserId: string;
        backendWalletId: string | null;
      }>("/auth/siwe/verify", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    emailRequestCode: (email: string) =>
      this.request<{ expiresAt: string; devCode?: string }>("/auth/email/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    emailVerifyCode: (input: { email: string; code: string }) =>
      this.request<{
        sessionToken: string;
        expiresAt: string;
        address: string;
        authMethod: string;
        endUserId: string;
        backendWalletId: string | null;
      }>("/auth/email/verify-code", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    session: (sessionToken: string) =>
      this.request<{
        endUserId: string;
        address: string;
        authMethod: string;
        backendWalletId: string | null;
        email: string | null;
      }>("/auth/session", {
        headers: { "X-Apkaya-Session": sessionToken },
      }),

    inAppSignMessage: (sessionToken: string, message: string) =>
      this.request<{ signature: string }>("/auth/in-app/sign-message", {
        method: "POST",
        headers: { "X-Apkaya-Session": sessionToken },
        body: JSON.stringify({ message }),
      }),

    inAppSendTransaction: (
      sessionToken: string,
      input: {
        chainId: number;
        toAddress: string;
        data?: string;
        valueWei?: string;
        idempotencyKey?: string;
      }
    ) =>
      this.request<TransactionRecord>("/auth/in-app/send-transaction", {
        method: "POST",
        headers: { "X-Apkaya-Session": sessionToken },
        body: JSON.stringify(input),
      }),
  };

  bridge = {
    supported: () =>
      this.request<{
        cdpConfigured: boolean;
        swapNetworks: string[];
        onrampAssets: string[];
        onrampChains: Array<{ chainId: number; name: string; rpcUrl?: string }>;
        swapChains: Array<{ chainId: number; name: string; rpcUrl?: string }>;
        swapTokens: Record<string, Array<{ symbol: string; address: string; decimals: number; isNative?: boolean }>>;
      }>("/bridge/supported"),

    onrampSession: (input: {
      address: string;
      chainId: number;
      assets?: string[];
      clientIp: string;
      presetFiatAmount?: number;
    }) =>
      this.request<{ token: string; popupUrl: string; expiresInSeconds: number }>(
        "/bridge/onramp/session",
        { method: "POST", body: JSON.stringify(input) }
      ),

    swapQuote: (input: {
      chainId: number;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      taker: string;
      slippageBps?: number;
    }) =>
      this.request<Record<string, unknown>>("/bridge/swap/quote", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    swapExecute: (input: {
      chainId: number;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      taker: string;
      slippageBps?: number;
    }) =>
      this.request<Record<string, unknown>>("/bridge/swap/execute", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}
