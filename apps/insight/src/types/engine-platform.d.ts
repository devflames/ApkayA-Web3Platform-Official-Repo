declare module "@apkaya/engine/platform" {
  import type { JsonRpcProvider } from "ethers";
  import type { Connection } from "@solana/web3.js";

  export type ChainFamily = "evm" | "solana";

  export interface ChainRef {
    chainFamily: ChainFamily;
    chainId: string;
  }

  export interface ChainConfig {
    chainFamily: ChainFamily;
    chainId: string;
    name: string;
    rpcUrl: string;
    commitment?: "processed" | "confirmed" | "finalized";
  }

  export function requireApiKey(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ): void;
  export function requireAdminKey(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ): void;
  export function devCors(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ): void;
  export function rateLimitByApiKey(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ): void;

  export function listChains(): ChainConfig[];
  export function getChainConfig(ref: ChainRef): ChainConfig;
  export function getProvider(ref: ChainRef): JsonRpcProvider;
  export function getConnection(ref: ChainRef): Connection;
  export function findChain(ref: ChainRef): ChainConfig | undefined;
  export function findEvmChainByNumericId(chainId: number | string): ChainConfig | undefined;
  export function chainKey(ref: ChainRef): string;

  export const pool: import("pg").Pool;
  export function query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  export function queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  export function execute(sql: string, params?: unknown[]): Promise<number>;
  export function runMigrations(): Promise<void>;
  export function closePool(): Promise<void>;
}
