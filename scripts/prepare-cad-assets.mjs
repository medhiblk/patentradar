import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "apps/web");
const oc = path.dirname(require.resolve("replicad-opencascadejs/package.json"));
const replica = path.resolve(path.dirname(require.resolve("replicad")), "..");
const pdf = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = path.join(app, "public/cad-kernel");
await mkdir(target, { recursive: true });
for (const file of ["replicad_single.js", "replicad_single.wasm"])
  await copyFile(
    path.join(oc, "dist", file),
    target + "/" + file,
  );
await copyFile(
  path.join(oc, "LICENSE"),
  target + "/OpenCascade-LICENSE.txt",
);
await copyFile(
  path.join(replica, "LICENSE"),
  target + "/Replicad-LICENSE.txt",
);
await writeFile(
  target + "/NOTICE.txt",
  `Replicad 1.2.0: MIT, copyright QuaroTech Sàrl; see Replicad-LICENSE.txt.\nreplicad-opencascadejs 1.1.0: LGPL-2.1-only; see OpenCascade-LICENSE.txt.\nUnmodified compiled module, dynamically loaded and replaceable under public/cad-kernel/.\nCorresponding source and build scripts: https://github.com/sgenoud/replicad/tree/e4b05f67dc4e2393a876ce8c5064a9c93db05bf1/packages/replicad-opencascadejs\nUpstream kernel: https://github.com/donalffons/opencascade.js\nThe PatentRadar browser worker contains fixed geometry operations only, not arbitrary user code.\n`,
);
console.log("Prepared self-hosted OpenCascade WASM CAD runtime.");
const documents = path.join(app, "public/document-kernel");
await mkdir(documents, { recursive: true });
for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  await copyFile(
    path.join(pdf, "legacy/build", file),
    documents + "/" + file,
  );
await copyFile(path.join(pdf, "LICENSE"), documents + "/LICENSE.txt");
console.log(
  "Prepared self-hosted PDF.js reader for bounded local document fallback.",
);

await mkdir(path.join(app,"docs"),{recursive:true});
await copyFile(path.join(root,"docs/API_MCP.md"),path.join(app,"docs/API_MCP.md"));
await mkdir(path.join(app,"cad"),{recursive:true});
for(const file of ["worker.py","requirements.txt"]) await copyFile(path.join(root,"services/cad",file),path.join(app,"cad",file));
