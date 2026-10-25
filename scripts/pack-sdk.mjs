import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync("artifacts", { recursive: true });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const workspace of ["contracts", "engineering", "sdk"]) {
  const result = spawnSync(npm, ["pack", "--workspace", "@formaproof/" + workspace, "--pack-destination", "artifacts"], { stdio: "inherit" });
  if (result.status) process.exit(result.status);
}
