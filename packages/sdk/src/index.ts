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
  /** Insight indexer API base URL. Defaults to baseUrl with port 3006 when omitted. */
  insightBaseUrl?: string;
}

export type ChainFamily = "evm" | "solana";

export interface ChainConfig {
  chainFamily: ChainFamily;
  chainId: string;
  name: string;
  rpcUrl: string;
  commitment?: string;
}

export interface ChainRefInput {
  chainFamily?: ChainFamily;
  chainId: string | number;
}

export interface BackendWallet {
  id: string;
  label: string;
  address: string;
  key_type: string;
  chain_family: ChainFamily;
  created_at: string;
  is_active: number;
}

export interface TransactionRecord {
  id: string;
  chain_family: ChainFamily;
  chain_id: string;
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
  chainFamily?: ChainFamily;
  chainId: string | number;
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

export interface InsightEvent {
  id: string;
  chain_family: ChainFamily;
  chain_id: string;
  block_number: string;
  block_hash: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
  event_name: string;
  decoded_args_json: Record<string, unknown>;
  indexed_at: string;
}

export interface TokenBalance {
  contract_address: string;
  balance: string;
}

export interface NftOwned {
  contract_address: string;
  token_id: string;
  balance: string;
  standard: "erc721" | "erc1155";
}

export interface IndexerChainStatus {
  chain_family: ChainFamily;
  chain_id: string;
  last_indexed_cursor: string;
  updated_at: string | null;
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isEvmAddress(address: string): boolean {
  return EVM_ADDRESS.test(address);
}

export function isSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS.test(address);
}

export function formatAddress(address: string, family: ChainFamily): string {
  if (family === "evm") return address.toLowerCase();
  return address;
}

export function formatTxHash(hash: string, family: ChainFamily): string {
  if (family === "evm") return hash.toLowerCase();
  return hash;
}

function chainQueryParams(ref: ChainRefInput): URLSearchParams {
  const params = new URLSearchParams({ chainId: String(ref.chainId) });
  if (ref.chainFamily) params.set("chainFamily", ref.chainFamily);
  return params;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class ApkayaClient {
  private baseUrl: string;
  private insightBaseUrl: string;
  private apiKey: string;

  constructor(options: ApkayaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.insightBaseUrl = (options.insightBaseUrl ?? inferInsightBaseUrl(this.baseUrl)).replace(
      /\/$/,
      ""
    );
  }

  private async request<T>(path: string, init?: RequestInit, baseUrl = this.baseUrl): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
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
    create: (label: string, options?: { chainFamily?: ChainFamily }) =>
      this.request<BackendWallet>("/backend-wallet/create", {
        method: "POST",
        body: JSON.stringify({ label, chainFamily: options?.chainFamily }),
      }),

    list: () => this.request<BackendWallet[]>("/backend-wallet"),

    get: (id: string) => this.request<BackendWallet>(`/backend-wallet/${id}`),

    balance: (id: string, chain: ChainRefInput) => {
      const params = chainQueryParams(chain);
      return this.request<{
        address: string;
        chainFamily: ChainFamily;
        chainId: string;
        balance: string;
        unit: "wei" | "lamports";
        balanceWei?: string;
        balanceLamports?: string;
      }>(`/backend-wallet/${id}/balance?${params}`);
    },
  };

  transactions = {
    send: (input: SendTransactionInput) =>
      this.request<TransactionRecord>("/transaction/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    status: (id: string) => this.request<TransactionRecord>(`/transaction/status/${id}`),

    list: (filters?: {
      status?: string;
      walletId?: string;
      chainFamily?: ChainFamily;
      chainId?: string | number;
      limit?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.walletId) params.set("walletId", filters.walletId);
      if (filters?.chainFamily) params.set("chainFamily", filters.chainFamily);
      if (filters?.chainId !== undefined) params.set("chainId", String(filters.chainId));
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
    list: () => this.request<ChainConfig[]>("/chain"),
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

  insight = {
    status: () => this.request<IndexerChainStatus[]>("/insight/status", undefined, this.insightBaseUrl),

    tokenBalances: (address: string, chain: ChainRefInput) => {
      const params = chainQueryParams(chain);
      return this.request<TokenBalance[]>(
        `/insight/tokens/${encodeURIComponent(address)}/balances?${params}`,
        undefined,
        this.insightBaseUrl
      );
    },

    nftsOwned: (address: string, filters: ChainRefInput & { contractAddress?: string }) => {
      const params = chainQueryParams(filters);
      if (filters.contractAddress) params.set("contractAddress", filters.contractAddress);
      return this.request<NftOwned[]>(
        `/insight/nfts/${encodeURIComponent(address)}/owned?${params}`,
        undefined,
        this.insightBaseUrl
      );
    },

    transfers: (filters: ChainRefInput & {
      contractAddress?: string;
      fromBlock?: number;
      toBlock?: number;
      limit?: number;
    }) => {
      const params = chainQueryParams(filters);
      if (filters.contractAddress) params.set("contractAddress", filters.contractAddress);
      if (filters.fromBlock !== undefined) params.set("fromBlock", String(filters.fromBlock));
      if (filters.toBlock !== undefined) params.set("toBlock", String(filters.toBlock));
      if (filters.limit) params.set("limit", String(filters.limit));
      return this.request<InsightEvent[]>(
        `/insight/transfers?${params}`,
        undefined,
        this.insightBaseUrl
      );
    },

    events: (filters: ChainRefInput & {
      contractAddress?: string;
      eventName?: string;
      limit?: number;
    }) => {
      const params = chainQueryParams(filters);
      if (filters.contractAddress) params.set("contractAddress", filters.contractAddress);
      if (filters.eventName) params.set("eventName", filters.eventName);
      if (filters.limit) params.set("limit", String(filters.limit));
      return this.request<InsightEvent[]>(`/insight/events?${params}`, undefined, this.insightBaseUrl);
    },
  };
}

function inferInsightBaseUrl(engineBaseUrl: string): string {
  try {
    const url = new URL(engineBaseUrl);
    if (!url.port || url.port === "3005") {
      url.port = "3006";
    }
    return url.origin;
  } catch {
    return "http://localhost:3006";
  }
}
