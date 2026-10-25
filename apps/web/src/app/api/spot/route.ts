import { createHash } from "node:crypto";
import { guard } from "@/lib/security";
import { documentForm, readPdfDocument, requirePdf, validateDocumentFile } from "@/lib/documents/ingestion";
import { DocumentError, documentErrorResponse } from "@/lib/documents/errors";
import { spotDocument } from "@/lib/search/spot";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  const began = Date.now();
  try {
    guard(req, "spot", 15);
    const form = await documentForm(req);
    const file = form.get("file");
    let pages: { page: number; text: string }[];
    let document: { sha256: string; pageCount: number; analyzedPages: number[]; truncated: boolean; inputKind: "pdf" | "description" };
    if (file instanceof File) {
      validateDocumentFile(file);
      const raw = new Uint8Array(await file.arrayBuffer());
      requirePdf(file, raw);
      const sha256 = createHash("sha256").update(raw).digest("hex");
      const parsed = await readPdfDocument(raw, req.signal);
      pages = parsed.pages;
      document = { sha256, pageCount: parsed.pageCount, analyzedPages: parsed.analyzedPages, truncated: parsed.truncated, inputKind: "pdf" };
    } else {
      const text = String(form.get("text") || "").trim().slice(0, 60000);
      if (text.length < 30) throw new DocumentError("DESCRIPTION_REQUIRED", 422, "Describe the technical functions in a few sentences, or upload a readable PDF.");
      pages = [{ page: 1, text }];
      document = { sha256: createHash("sha256").update(text).digest("hex"), pageCount: 1, analyzedPages: [1], truncated: false, inputKind: "description" };
    }
    if (pages.map(p => p.text).join(" ").trim().length < 30)
      throw new DocumentError("SCANNED_PDF", 422, "This PDF has no readable text layer. Use its text-based publication PDF or paste OCR text. No patent search was completed.");
    const result = await spotDocument({ pages, consentToPublicLookup: form.get("consent") === "true", signal: req.signal });
    console.info(JSON.stringify({ event: "spot_complete", elapsedMs: Date.now() - began, matches: result.matches.length, indexed: result.coverage.indexedPatentCount }));
    return Response.json({ ...result, document }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return documentErrorResponse(error); }
}
