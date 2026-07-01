declare module "@apkaya/engine/platform" {
  import type { Request, Response, NextFunction } from "express";
  import type { JsonRpcProvider } from "ethers";

  export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
  }

  export function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void>;
  export function requireAdminKey(req: Request, res: Response, next: NextFunction): void;
  export function rateLimitByApiKey(req: Request, res: Response, next: NextFunction): void;
  export function listChains(): ChainConfig[];
  export function getChainConfig(chainId: number): ChainConfig;
  export function getProvider(chainId: number): JsonRpcProvider;
}
