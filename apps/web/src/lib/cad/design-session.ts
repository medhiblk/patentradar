import { AssemblySchema, type AssemblySpec } from "./schema";
import type { ImportedSolid } from "./browser";
import { PRIVATE_SIGNOUT_EVENT } from "../private-session";

export type DesignSession = {
  spec: AssemblySpec;
  source: { name: string; hash: string };
  imports: Record<string, ImportedSolid>;
  sourceFile?: File;
};
let retained: DesignSession | null = null;
let listening = false;
/** Memory only. File bytes are never serialized into browser storage. */
export function setDesignSession(value: DesignSession) {
  const spec = AssemblySchema.parse(value.spec);
  const ids = new Set(spec.components.map((part) => part.id));
  retained = {
    spec: structuredClone(spec),
    source: { ...value.source },
    sourceFile: value.sourceFile,
    imports: Object.fromEntries(Object.entries(value.imports)
      .filter(([id]) => ids.has(id))
      .map(([id, source]) => [id, { ...source }])),
  };
  if (typeof window !== "undefined" && !listening) {
    window.addEventListener(PRIVATE_SIGNOUT_EVENT, clearDesignSession);
    listening = true;
  }
}
export function peekDesignSession(): DesignSession | null {
  return retained ? {
    spec: structuredClone(retained.spec), source: { ...retained.source }, sourceFile: retained.sourceFile,
    imports: Object.fromEntries(Object.entries(retained.imports).map(([id, source]) => [id, { ...source }])),
  } : null;
}
export function takeDesignSession() {
  const snapshot = peekDesignSession();
  retained = null;
  return snapshot;
}
export function clearDesignSession() { retained = null; }
