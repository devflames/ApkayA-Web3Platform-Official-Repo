import "dotenv/config";
import { runMigrations } from "./index.js";

runMigrations()
  .then(() => {
    console.log("Insight migrations complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Insight migration failed:", err);
    process.exit(1);
  });
