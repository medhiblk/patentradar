import { describe, it, expect, vi, afterEach } from "vitest";
import {
  docdb,
  normalizeRow,
  retrieve,
} from "../src/lib/providers/google-patents";
afterEach(() => vi.unstubAllEnvs());
describe("BigQuery adapter", () => {
  it("uses exact DOCDB IDs without guessing kinds", () => {
    expect(docdb("US7650331B1")).toBe("US-7650331-B1");
    expect(() => docdb("US7650331")).toThrow();
    expect(() => docdb("US' OR 1=1")).toThrow();
  });
  it("keeps multilingual text and absent fields honest", () => {
    const p = normalizeRow({
      publication_number: "US-7650331-B1",
      title_localized: [{ language: "zh", text: "专利" }],
      assignee: [],
      publication_date: 0,
      family_id: "",
      claims_localized: [],
    });
    expect(p.title).toBe("专利");
    expect(p.publicationDate).toBeUndefined();
    expect(p.claims).toBeUndefined();
    expect(p.familyId).toBeUndefined();
  });
  it("fails closed without opt-in", async () => {
    vi.stubEnv("ENABLE_BIGQUERY", "false");
    await expect(retrieve("instrument", [])).rejects.toThrow("disabled");
  });
});
