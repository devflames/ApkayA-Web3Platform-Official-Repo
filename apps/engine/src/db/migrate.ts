import "dotenv/config";
import { closePool, runMigrations } from "./index.js";

await runMigrations();
await closePool();
