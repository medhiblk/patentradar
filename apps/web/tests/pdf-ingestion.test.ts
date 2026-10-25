import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { POST as extract } from "../src/app/api/extract/route";
import { POST as interpret } from "../src/app/api/cad/interpret/route";
import { documentForm, readVisionPages } from "../src/lib/documents/ingestion";
import { documentErrorResponse } from "../src/lib/documents/errors";
import { DOCUMENT_LIMITS } from "../src/lib/documents/limits";
import { studioRequest } from "../src/lib/cad/studio-request";
const { parse, reserveAI } = vi.hoisted(() => ({ parse: vi.fn(), reserveAI: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse }; } }));
vi.mock("../src/lib/platform/auth", () => ({ reserveAI }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const sample = () => readFileSync("public/examples/mechanical-assembly.pdf");
function request(file: File, consent = false, extra?: (form: FormData) => void) {
  const form = new FormData(); form.set("file", file); form.set("consent", String(consent)); extra?.(form);
  return new Request("https://app.example/api/extract", { method: "POST", body: form });
}
async function blankPdf(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return new Uint8Array(await doc.save());
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+qN8AAAAASUVORK5CYII=", "base64");
function previews(form: FormData, raw: Uint8Array, pageNumbers: number[] = [1]) {
  form.set("pdfImagePages", JSON.stringify(pageNumbers));
  form.set("pdfSourceHash", createHash("sha256").update(raw).digest("hex"));
  for (const page of pageNumbers) form.append("pdfPageImage", new File([png], `page-${page}.png`, { type: "image/png" }));
}

describe("shared real PDF ingestion", () => {
  it("accepts the physical module's entered technical context before checking minimum text length", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const context = "Components: a rotor, a stator and a bearing. Function: an electric drive rotates the shaft inside the housing. Interfaces: the bearing supports the shaft.";
    const form = new FormData(); form.set("text", ""); form.set("context", context); form.set("consent", "false");
    const response = await extract(new Request("https://app.example/api/extract", { method: "POST", body: form }));
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.notice).toContain("entered technical context");
    expect(data.profile.technicalFeatures.every((feature: { description: string }) => context.includes(feature.description))).toBe(true);
    expect(parse).not.toHaveBeenCalled();
  });
  it.each(["application/pdf", "application/octet-stream", ""])("extracts the real text PDF with file-provider MIME '%s'", async type => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const raw = sample();
    const response = await extract(request(new File([raw], "downloaded.pdf", { type })));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.profile.technicalFeatures.length).toBeGreaterThan(0);
    expect(data.ingestion.sourceHash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(data.ingestion.analyzedPages).toEqual([1]);
    expect(parse).not.toHaveBeenCalled(); expect(reserveAI).not.toHaveBeenCalled();
  });
  it("identifies an image-only PDF instead of silently completing an empty interpretation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const raw = await blankPdf();
    for (const handler of [extract, interpret]) {
      const response = await handler(request(new File([raw], "scan.pdf", { type: "application/pdf" })));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "SCANNED_PDF" });
    }
    expect(parse).not.toHaveBeenCalled();
  });
  it("rejects an over-80-page real PDF before interpretation", async () => {
    const response = await extract(request(new File([await blankPdf(81)], "long.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(413); expect(await response.json()).toMatchObject({ code: "PDF_PAGE_LIMIT" });
  });
  it("rejects a false PDF signature and a damaged PDF without leaking parser details", async () => {
    const invalid = await extract(request(new File(["<html>secret-server-data</html>"], "fake.pdf", { type: "application/pdf" })));
    expect(invalid.status).toBe(400);
    expect(JSON.stringify(await invalid.json())).not.toContain("secret-server-data");
    const damaged = await extract(request(new File(["%PDF-1.7\nBroken-source-secret"], "broken.pdf", { type: "application/pdf" })));
    expect(damaged.status).toBe(422); expect(await damaged.json()).toMatchObject({ code: "UNREADABLE_PDF" });
  });
  it("enforces actual request bytes without trusting Content-Length", async () => {
    const req = new Request("https://app.example/api/extract", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(DOCUMENT_LIMITS.bodyBytes + 1)); controller.close(); } }), duplex: "half" } as RequestInit);
    await expect(documentForm(req)).rejects.toMatchObject({ status: 413, code: "DOCUMENT_TOO_LARGE" });
  });
  it("allows a safe local fallback after an explicit upload timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Upload timed out." }, { status: 408 })));
    await expect(studioRequest("/api/cad/interpret", new FormData())).rejects.toMatchObject({ status: 408, recoverable: true });
  });
});

describe("consented PDF image interpretation without a native Python runtime", () => {
  it("accepts bounded source-bound previews but never processes them without consent", async () => {
    const raw = await blankPdf(), hash = createHash("sha256").update(raw).digest("hex"), form = new FormData();
    previews(form, raw);
    await expect(readVisionPages(form, false, hash, 1)).rejects.toMatchObject({ status: 403 });
    await expect(readVisionPages(form, true, "different-source", 1)).rejects.toMatchObject({ code: "VISION_SOURCE_MISMATCH" });
    await expect(readVisionPages(form, true, hash, 1)).resolves.toMatchObject([{ page: 1, mime: "image/png" }]);
    form.set("pdfImagePages", "[2]");
    await expect(readVisionPages(form, true, hash, 1)).rejects.toMatchObject({ code: "INVALID_PAGE_PREVIEWS" });
  });
  it("uses actual supplied image content for a scanned PDF and marks transcription unverified", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-key-not-a-real-credential"); vi.stubEnv("CAD_PYTHON", "");
    parse.mockResolvedValueOnce({ output_parsed: {
      pages: [{ page: 1, text: "An optical sensor measures the sample." }],
      profile: { title: "Optical instrument", domain: "Optics", operatingPrinciple: "An optical sensor measures the sample.", technicalFeatures: [{ name: "Optical sensor", description: "An optical sensor measures the sample." }], searchKeywords: ["optical sensing"] },
    } });
    const raw = await blankPdf();
    const response = await extract(request(new File([raw], "scanned.pdf", { type: "application/octet-stream" }), true, form => previews(form, raw)));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.evidence[0]).toMatchObject({ page: 1, basis: "visual-unverified" });
    expect(data.ingestion.imagePages).toEqual([1]);
    expect(reserveAI).toHaveBeenCalledOnce();
    expect(parse.mock.calls[0][0].input[1].content.some((part: { type: string }) => part.type === "input_image")).toBe(true);
  });
  it("preserves sign-in and quota statuses and keeps transient failures recoverable", async () => {
    expect(documentErrorResponse(new Error("Sign in to access your private workspace.")).status).toBe(401);
    expect(documentErrorResponse(new Error("Daily AI call allowance reached.")).status).toBe(429);
    expect(documentErrorResponse(new Error("Provider raw secret body")).status).toBe(503);
    vi.stubEnv("OPENAI_API_KEY", "fixture-key-not-a-real-credential");
    reserveAI.mockRejectedValueOnce(new Error("Sign in to access your private workspace."));
    const response = await interpret(request(new File([sample()], "real.pdf", { type: "application/pdf" }), true));
    expect(response.status).toBe(401); expect(parse).not.toHaveBeenCalled();
  });
  it("passes scanned engineering pages to multimodal AI without Python and keeps geometry unverified", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-key-not-a-real-credential"); vi.stubEnv("CAD_PYTHON", "");
    parse.mockResolvedValueOnce({ output_parsed: { title: "Mocked visual interpretation", limitations: [], components: [{
      id: "plate", name: "Fixture plate", description: "Mocked output to verify evidence handling, not a real OCR result", shape: "box",
      dimensions: { length: 80, width: 50, height: 6, diameter: null, innerDiameter: null },
      material: "Unknown", sourcePage: 1, sourceQuote: "", basis: "visual-unverified", connections: [], position: [20, 20, 20], rotation: [20, 20, 20],
    }] } });
    const raw = await blankPdf();
    const response = await interpret(request(new File([raw], "scanned-part.pdf", { type: "application/pdf" }), true, form => previews(form, raw)));
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.spec.components[0]).toMatchObject({ basis: "visual-unverified", sourcePage: 1, position: [0, 0, 0], rotation: [0, 0, 0] });
    expect(data.notice).toMatch(/unverified/);
    expect(reserveAI).toHaveBeenCalledOnce();
    expect(parse.mock.calls[0][0].input[1].content.some((part: { type: string }) => part.type === "input_image")).toBe(true);
  });
});
