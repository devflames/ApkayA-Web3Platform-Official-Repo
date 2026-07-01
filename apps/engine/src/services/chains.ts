import { JsonRpcProvider } from "ethers";

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
}

const chains = new Map<number, ChainConfig>();
const providers = new Map<number, JsonRpcProvider>();

/**
 * Scans process.env for CHAIN_<id>_RPC_URL / CHAIN_<id>_NAME pairs and
 * registers each as a supported chain. This means adding a new chain is a
 * config change — no code/deploy required, matching the "abstraction layer
 * per chain" principle from the platform spec.
 */
function loadChainsFromEnv(): void {
  const rpcPattern = /^CHAIN_(\d+)_RPC_URL$/;

  for (const key of Object.keys(process.env)) {
    const match = key.match(rpcPattern);
    if (!match) continue;

    const chainId = Number(match[1]);
    const rpcUrl = process.env[key];
    const name = process.env[`CHAIN_${chainId}_NAME`] || `Chain ${chainId}`;

    if (!rpcUrl) continue;

    chains.set(chainId, { chainId, name, rpcUrl });
    providers.set(chainId, new JsonRpcProvider(rpcUrl, chainId));
  }

  if (chains.size === 0) {
    throw new Error(
      "No chains configured. Set at least one CHAIN_<id>_RPC_URL env var (see .env.example)."
    );
  }
}

loadChainsFromEnv();

export function getChainConfig(chainId: number): ChainConfig {
  const config = chains.get(chainId);
  if (!config) {
    throw new Error(
      `Unsupported chain id ${chainId}. Configure it via CHAIN_${chainId}_RPC_URL.`
    );
  }
  return config;
}

export function getProvider(chainId: number): JsonRpcProvider {
  const provider = providers.get(chainId);
  if (!provider) {
    throw new Error(`No provider configured for chain id ${chainId}.`);
  }
  return provider;
}

export function listChains(): ChainConfig[] {
  return Array.from(chains.values());
}
