import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "..", "templates");

const TEMPLATE_CHOICES = [
  { title: "Contract project (Solidity + Hardhat)", value: "contract-project" },
  { title: "Frontend app (React + Vite, wired to Engine SDK)", value: "frontend-app" },
];

function copyTemplate(src: string, dest: string, projectName: string): void {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyTemplate(srcPath, destPath, projectName);
    } else {
      const contents = fs.readFileSync(srcPath, "utf-8").replaceAll("{{PROJECT_NAME}}", projectName);
      fs.writeFileSync(destPath, contents);
    }
  }
}

export async function createCommand(nameArg?: string): Promise<void> {
  const answers = await prompts([
    {
      type: nameArg ? null : "text",
      name: "name",
      message: "Project name",
      initial: "my-apkaya-app",
    },
    {
      type: "select",
      name: "template",
      message: "What are you building?",
      choices: TEMPLATE_CHOICES,
    },
  ]);

  const projectName = nameArg ?? answers.name;
  if (!projectName || !answers.template) {
    console.log("Cancelled.");
    return;
  }

  const dest = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(dest)) {
    console.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  const templateSrc = path.join(TEMPLATES_DIR, answers.template);
  copyTemplate(templateSrc, dest, projectName);

  console.log(`\nCreated ${projectName}/`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${projectName}`);
  console.log(`  npm install`);
  if (answers.template === "contract-project") {
    console.log(`  npm run compile`);
    console.log(`  apkaya deploy`);
  } else {
    console.log(`  npm run dev`);
  }
}
