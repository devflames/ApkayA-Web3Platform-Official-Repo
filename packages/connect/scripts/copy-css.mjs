import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "src/react/connect.css");
const dest = path.join(process.cwd(), "dist/react/connect.css");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
