import { execFileSync } from "node:child_process";
import fs from "node:fs";

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "devflames",
  GIT_AUTHOR_EMAIL: "devflames@gmail.com",
  GIT_COMMITTER_NAME: "devflames",
  GIT_COMMITTER_EMAIL: "devflames@gmail.com",
};

const msg = fs.readFileSync(".git/COMMIT_MSG.txt", "utf8");
const parent = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const tree = execFileSync("git", ["write-tree"], { encoding: "utf8" }).trim();

const newHash = execFileSync("git", ["commit-tree", tree, "-p", parent], {
  env,
  input: msg,
  encoding: "utf8",
}).trim();

execFileSync("git", ["reset", "--hard", newHash], { stdio: "inherit" });
console.log(execFileSync("git", ["log", "-1", "--format=%H %an <%ae>%n%n%B"], { encoding: "utf8" }));
