import { describe, it, expect } from "vitest";
import {
  AssemblySchema,
  ComponentSchema,
  extractMeasured,
  buildable,
} from "../src/lib/cad/schema";
import {
  starterPart,
  housingFor,
  fitInHousing,
  mergeAssembly,
  billOfMaterials,
  bomCSV,
  inspectAssembly,
} from "../src/lib/cad/workbench";
import { POST as inspectAPI } from "../src/app/api/v1/cad/inspect/route";
const assembly = (components: ReturnType<typeof starterPart>[]) => ({
  title: "Prototype",
  components,
  limitations: [],
});
describe("engineering workbench", () => {
  it("keeps supplied manufacturer footprint separate from missing occupied height", () => {
    const p = starterPart("uno-pcb");
    expect(p.dimensions.length).toBe(68.6);
    expect(p.dimensions.height).toBeNull();
    expect(buildable(p)).toBe(false);
    expect(() => housingFor(p, { clearance: 0.5, wall: 2, floor: 2 })).toThrow(
      /dimensions/,
    );
  });
  it("creates and checks a housing through rotated and translated local coordinates", () => {
    const p = starterPart("pico-pcb");
    p.position = [10, 20, 30];
    p.rotation = [25, 15, 47];
    const h = housingFor(p, { clearance: 0.5, wall: 2, floor: 2 });
    expect(fitInHousing(h, p)).toEqual({
      status: "fits-envelope",
      gapsMm: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });
    p.position[0] += 100;
    expect(fitInHousing(h, p).status).toBe("does-not-fit");
    h.dimensions.width = 1;
    expect(buildable(h)).toBe(false);
  });
  it("relabels incoming ids and internal fit references when combining assemblies", () => {
    const p = starterPart("pico-pcb"),
      h = housingFor(p, { clearance: 0.5, wall: 2, floor: 2 });
    const combined = mergeAssembly(assembly([p, h]), assembly([p, h]));
    expect(new Set(combined.components.map((p) => p.id)).size).toBe(4);
    expect(combined.components[3].pocket?.targetId).toBe(
      combined.components[2].id,
    );
    expect(() => AssemblySchema.parse(assembly([p, p]))).toThrow();
  });
  it("does not exceed the part limit or silently drop new parts", () => {
    const rows = Array.from({ length: 20 }, () => starterPart("plate"));
    expect(() =>
      mergeAssembly(assembly(rows), assembly([starterPart("shaft")])),
    ).toThrow(/20/);
  });
  it("keeps currencies separate and excludes unknown prices and royalties", () => {
    const a = starterPart("board"),
      b = starterPart("board");
    a.commerce = {
      url: "https://www.amazon.fr/",
      unitPrice: 12.34,
      currency: "EUR",
      recordedAt: new Date().toISOString(),
      basis: "user-entered",
    };
    b.commerce = { ...a.commerce, unitPrice: 8, currency: "USD" };
    const result = billOfMaterials(assembly([a, b, starterPart("plate")]));
    expect(result.subtotals).toEqual({ EUR: 12.34, USD: 8 });
    expect(result.unpriced).toBe(1);
    a.name = '=WEBSERVICE("evil")';
    expect(bomCSV(assembly([a]))).toContain("'=WEBSERVICE");
  });
  it("rejects executable and secret-bearing supplier URLs", () => {
    const p = starterPart("board");
    for (const url of [
      "javascript:alert(1)",
      "https://token:secret@example.com",
    ])
      expect(() =>
        ComponentSchema.parse({ ...p, referenceUrl: url }),
      ).toThrow();
  });
  it("identifies explicitly listed manual parts without fabricating geometry", () => {
    const s = extractMeasured([
      { page: 2, text: "Components\n1. Rotor\n2. Stator\n3. Drive shaft" },
    ]);
    expect(s.components).toHaveLength(3);
    expect(
      s.components.every(
        (p) =>
          p.shape === "unresolved" &&
          p.dimensions.length === null &&
          p.sourcePage === 2,
      ),
    ).toBe(true);
    expect(s.components[0].sourceQuote).toBe("1. Rotor");
  });
  it("never clears patents based on empty rights or a declared permission", () => {
    const p = starterPart("pico-pcb");
    p.rights = {
      status: "permission-documented",
      evidenceUrl: "https://example.org/licence",
      note: "User claim only",
    };
    const r = inspectAssembly(assembly([p]));
    expect(r.patentClearance).toBe("NOT ESTABLISHED");
    expect(r.rights[0].verified).toBe(false);
  });
  it("exposes stateless assembly inspection through the versioned API", async () => {
    const r = await inspectAPI(
      new Request("http://localhost:3000/api/v1/cad/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assembly([starterPart("board")])),
      }),
    );
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.measurementsRequired).toHaveLength(1);
    expect(d.patentClearance).toBe("NOT ESTABLISHED");
  });
});
