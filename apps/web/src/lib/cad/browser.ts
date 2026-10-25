import type { AssemblySpec } from "./schema";
import type { MeshPart } from "@/components/cad-viewer";
export type BrowserGeometry = {
  parts: MeshPart[];
  step: string;
  stl: string;
  engine: string;
  units: string;
  fused?: boolean;
  exportVolume?: number;
};
export type ImportedSolid = { file: File; solidIndex: number };
export async function browserCAD(
  action: "build" | "import",
  payload:
    | (AssemblySpec & {
        imports?: Record<string, ImportedSolid>;
        fuse?: boolean;
      })
    | { file: File; placements?: unknown[] },
): Promise<BrowserGeometry> {
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined")
    throw new Error(
      "This browser does not support the WebAssembly CAD engine.",
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./browser.worker.ts", import.meta.url), {
      type: "module",
    });
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error("CAD computation timed out; reduce assembly complexity."),
      );
    }, 90000);
    const close = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onerror = () => {
      close();
      reject(
        new Error(
          "Unable to load CAD kernel. Check connection and browser WebAssembly support.",
        ),
      );
    };
    worker.onmessage = (event) => {
      if (event.data.id !== id) return;
      close();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.postMessage({ id, action, payload });
  });
}
