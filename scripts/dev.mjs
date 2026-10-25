import { spawn } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(process.execPath, ["node_modules/typescript/bin/tsc", "-b", "packages/contracts", "packages/engineering", "packages/sdk", "--watch", "--preserveWatchOutput"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev", "--workspace", "@formaproof/web"], { stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill("SIGTERM"); process.exitCode = code; }
for (const child of children) { child.on("error", () => stop(1)); child.on("exit", (code) => stop(code || 0)); }
process.on("SIGINT", () => stop()); process.on("SIGTERM", () => stop());
