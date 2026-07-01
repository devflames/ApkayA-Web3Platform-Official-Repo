import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "src/react/bridge.css");
const dest = path.join(process.cwd(), "dist/react/bridge.css");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
