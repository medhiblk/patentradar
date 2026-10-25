import { afterEach, expect, it } from "vitest";
import { starterPart } from "../src/lib/cad/workbench";
import { DesignRevision, currentDesignResult } from "../src/lib/cad/design-revision";
import { setDesignSession, takeDesignSession, peekDesignSession, clearDesignSession } from "../src/lib/cad/design-session";
import { requireSupportedStepSolids } from "../src/lib/cad/step-solids";

afterEach(clearDesignSession);

it("rejects a finished geometry job when dimensions or imported references changed meanwhile", async () => {
  const revision = new DesignRevision();
  let finish!: (value: { step: string }) => void;
  const calculation = currentDesignResult(revision, () => new Promise<{ step: string }>(resolve => { finish = resolve; }));
  revision.changed();
  finish({ step: "old geometry fixture" });
  await expect(calculation).rejects.toThrow("design changed");
  const rebuilt = await currentDesignResult(revision, async () => ({ step: "current geometry fixture" }));
  expect(rebuilt.revision).toBe(revision.capture());
  expect(rebuilt.value.step).toBe("current geometry fixture");
});

it("keeps STEP source references through a research handoff without sharing mutable parameters", () => {
  const part = starterPart("plate");
  const original = new File(["ISO-10303-21;\nfixture source"], "source.step", { type: "application/step" });
  const sourceDocument = new File(["%PDF-fixture source"], "technical.pdf", { type: "application/pdf" });
  const spec = { title: "Private fixture", components: [part], limitations: [] };
  setDesignSession({ spec, source: { name: "source.step", hash: "" }, sourceFile: sourceDocument, imports: { [part.id]: { file: original, solidIndex: 0 } } });
  spec.components[0].name = "changed outside session";
  const preview = peekDesignSession()!;
  expect(preview.spec.components[0].name).not.toBe("changed outside session");
  preview.spec.components[0].name = "changed outside peek";
  const restored = takeDesignSession()!;
  expect(restored.spec.components[0].name).not.toBe("changed outside peek");
  expect(restored.imports[part.id].file).toBe(original);
  expect(preview.sourceFile).toBe(sourceDocument);
  expect(restored.sourceFile).toBe(sourceDocument);
  expect(takeDesignSession()).toBeNull();
});

it("does not retain geometry references belonging to another assembly", () => {
  const part = starterPart("plate");
  const unrelated = new File(["fixture"], "other.step");
  setDesignSession({ spec: { title: "Current", components: [part], limitations: [] }, source: { name: "", hash: "" }, imports: { unrelated: { file: unrelated, solidIndex: 0 } } });
  expect(peekDesignSession()?.imports).toEqual({});
  clearDesignSession();
  expect(peekDesignSession()).toBeNull();
});

it("refuses oversized STEP assemblies instead of silently removing their solids", () => {
  const supported = Array.from({ length: 20 }, (_, id) => ({ id }));
  expect(requireSupportedStepSolids(supported)).toBe(supported);
  expect(() => requireSupportedStepSolids([...supported, { id: 20 }])).toThrow("21 solids");
  expect(() => requireSupportedStepSolids([])).toThrow("No supported STEP solids");
});
