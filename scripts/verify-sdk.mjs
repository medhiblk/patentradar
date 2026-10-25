import { mkdtemp, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isolated = await mkdtemp(path.join(tmpdir(), "formaproof-consumer-"));
const env = { ...process.env };
delete env.FORMAPROOF_API_URL; // This check must never query an external patent service.
function run(command, args) {
  const result = spawnSync(command, args, { cwd: isolated, env, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Isolated SDK integration check failed.");
}
try {
  await writeFile(path.join(isolated, "package.json"), JSON.stringify({ name: "formaproof-isolated-consumer", private: true, type: "module" }));
  const artifacts = ["contracts", "engineering", "sdk"].map(name => path.join(root, "artifacts", `formaproof-${name}-0.1.0.tgz`));
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...artifacts]);
  await copyFile(path.join(root, "examples/integration.mjs"), path.join(isolated, "integration.mjs"));
  run(process.execPath, ["integration.mjs"]);
  run(process.execPath, ["--input-type=commonjs", "-e", "if (typeof require('@formaproof/sdk').FormaProofClient !== 'function') process.exit(1)"]);
  await writeFile(path.join(isolated, "consumer.ts"), `import { FormaProofClient, type SearchQuery } from "@formaproof/sdk";
import { type PatentRecord } from "@formaproof/contracts";
import { AssemblySchema } from "@formaproof/engineering";
const client = new FormaProofClient();
const query: SearchQuery = { query: "optics", shareQuery: true };
const records: Promise<PatentRecord[]> = client.search(query).then(result => result.patents);
void records; void AssemblySchema;
`);
  run(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "consumer.ts"]);
  console.log(JSON.stringify({ isolatedPackageInstall: true, esm: true, node24CommonJs: true, typescriptConsumer: true }));
} finally {
  await rm(isolated, { recursive: true, force: true });
}
