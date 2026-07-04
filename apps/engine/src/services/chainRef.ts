export type ChainFamily = "evm" | "solana";

export interface ChainRef {
  chainFamily: ChainFamily;
  chainId: string;
}

export function chainKey(ref: ChainRef): string {
  return `${ref.chainFamily}:${ref.chainId}`;
}

export function parseChainFamily(value: unknown): ChainFamily | null {
  if (value === "evm" || value === "solana") return value;
  return null;
}

/** Accept API chainId as number (EVM compat) or string. */
export function normalizeChainIdInput(chainId: string | number): string {
  return String(chainId);
}

export function evmChainRef(chainId: string | number): ChainRef {
  return { chainFamily: "evm", chainId: normalizeChainIdInput(chainId) };
}

export function resolveChainRef(input: {
  chainFamily?: unknown;
  chainId: string | number;
}): ChainRef {
  const family = parseChainFamily(input.chainFamily) ?? "evm";
  return { chainFamily: family, chainId: normalizeChainIdInput(input.chainId) };
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isEvmAddress(address: string): boolean {
  return EVM_ADDRESS.test(address);
}

export function isSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS.test(address);
}

export function validateAddressForFamily(address: string, family: ChainFamily): boolean {
  return family === "evm" ? isEvmAddress(address) : isSolanaAddress(address);
}

export function balanceUnit(family: ChainFamily): "wei" | "lamports" {
  return family === "evm" ? "wei" : "lamports";
}
