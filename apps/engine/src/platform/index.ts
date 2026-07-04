/** Shared platform modules for ApkayA services (Engine, Insight, …). */
export { requireApiKey, requireAdminKey } from "../middleware/auth.js";
export { rateLimitByApiKey } from "../middleware/rateLimit.js";
export {
  listChains,
  getChainConfig,
  getProvider,
  getConnection,
  findChain,
  findEvmChainByNumericId,
  type ChainConfig,
} from "../services/chains.js";
export type { ChainFamily, ChainRef } from "../services/chainRef.js";
export { chainKey } from "../services/chainRef.js";
export { pool, query, queryOne, execute, runMigrations, closePool } from "../db/index.js";
