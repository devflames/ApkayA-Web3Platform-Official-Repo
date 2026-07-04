import { JsonRpcProvider } from "ethers";
import { Connection } from "@solana/web3.js";
import type { ChainFamily, ChainRef } from "./chainRef.js";
import { chainKey } from "./chainRef.js";

export type SolanaCommitment = "processed" | "confirmed" | "finalized";

export interface ChainConfig {
  chainFamily: ChainFamily;
  chainId: string;
  name: string;
  rpcUrl: string;
  commitment?: SolanaCommitment;
}

const chains = new Map<string, ChainConfig>();
const evmProviders = new Map<string, JsonRpcProvider>();
const solanaConnections = new Map<string, Connection>();

function parseFamily(raw: string | undefined, envId: string): ChainFamily {
  const value = (raw ?? "evm").toLowerCase();
  if (value === "solana") return "solana";
  if (value === "evm") return "evm";
  throw new Error(`Invalid CHAIN_${envId}_FAMILY="${raw}". Use "evm" or "solana".`);
}

function parseCommitment(raw: string | undefined): SolanaCommitment | undefined {
  if (!raw) return undefined;
  if (raw === "processed" || raw === "confirmed" || raw === "finalized") return raw;
  return undefined;
}

function loadChainsFromEnv(): void {
  const rpcPattern = /^CHAIN_([A-Za-z0-9_]+)_RPC_URL$/;

  for (const key of Object.keys(process.env)) {
    const match = key.match(rpcPattern);
    if (!match) continue;

    const envId = match[1]!;
    const rpcUrl = process.env[key];
    if (!rpcUrl) continue;

    const chainFamily = parseFamily(process.env[`CHAIN_${envId}_FAMILY`], envId);
    const name = process.env[`CHAIN_${envId}_NAME`] || `${chainFamily} ${envId}`;
    const commitment = parseCommitment(process.env[`CHAIN_${envId}_COMMITMENT`]);

    const config: ChainConfig = {
      chainFamily,
      chainId: envId,
      name,
      rpcUrl,
      commitment,
    };

    const keyId = chainKey(config);
    chains.set(keyId, config);

    if (chainFamily === "evm") {
      evmProviders.set(keyId, new JsonRpcProvider(rpcUrl, Number(envId)));
    } else {
      solanaConnections.set(
        keyId,
        new Connection(rpcUrl, commitment ?? "confirmed")
      );
    }
  }

  if (chains.size === 0) {
    throw new Error(
      "No chains configured. Set at least one CHAIN_<id>_RPC_URL env var (see .env.example)."
    );
  }
}

loadChainsFromEnv();

export function getChainConfig(ref: ChainRef): ChainConfig {
  const config = chains.get(chainKey(ref));
  if (!config) {
    throw new Error(
      `Unsupported chain ${ref.chainFamily}:${ref.chainId}. Configure CHAIN_${ref.chainId}_RPC_URL.`
    );
  }
  return config;
}

export function findChain(ref: ChainRef): ChainConfig | undefined {
  return chains.get(chainKey(ref));
}

/** EVM-only backward compat: numeric chain id without family. */
export function findEvmChainByNumericId(chainId: number | string): ChainConfig | undefined {
  const id = String(chainId);
  return chains.get(chainKey({ chainFamily: "evm", chainId: id }));
}

export function getProvider(ref: ChainRef): JsonRpcProvider {
  const config = getChainConfig(ref);
  if (config.chainFamily !== "evm") {
    throw new Error(`Chain ${config.chainId} is not EVM — use getConnection() instead.`);
  }
  const provider = evmProviders.get(chainKey(ref));
  if (!provider) {
    throw new Error(`No EVM provider for ${ref.chainFamily}:${ref.chainId}.`);
  }
  return provider;
}

/** @deprecated Use getProvider({ chainFamily: 'evm', chainId: String(chainId) }). */
export function getProviderByNumericChainId(chainId: number): JsonRpcProvider {
  const config = findEvmChainByNumericId(chainId);
  if (!config) {
    throw new Error(`No provider configured for EVM chain id ${chainId}.`);
  }
  return getProvider(config);
}

export function getConnection(ref: ChainRef): Connection {
  const config = getChainConfig(ref);
  if (config.chainFamily !== "solana") {
    throw new Error(`Chain ${config.chainId} is not Solana — use getProvider() instead.`);
  }
  const connection = solanaConnections.get(chainKey(ref));
  if (!connection) {
    throw new Error(`No Solana connection for ${ref.chainFamily}:${ref.chainId}.`);
  }
  return connection;
}

export function listChains(): ChainConfig[] {
  return Array.from(chains.values());
}

export function chainConfigMatches(config: ChainConfig, ref: ChainRef): boolean {
  return config.chainFamily === ref.chainFamily && config.chainId === ref.chainId;
}
