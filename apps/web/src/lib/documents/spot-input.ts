import { createHash } from "node:crypto";
import { documentForm, readPdfDocument, requirePdf, validateDocumentFile } from "./ingestion";
import { DocumentError } from "./errors";

export type SpotDocument = {
  sha256: string; pageCount: number; analyzedPages: number[]; truncated: boolean;
  inputKind: "pdf" | "description";
};

/** Shared bounded ingestion. Files remain in request memory, never public storage. */
export async function readSpotInput(req: Request) {
  const form = await documentForm(req);
  const file = form.get("file");
  let pages: { page: number; text: string }[];
  let document: SpotDocument;
  if (file instanceof File) {
    validateDocumentFile(file);
    const raw = new Uint8Array(await file.arrayBuffer());
    requirePdf(file, raw);
    // PDF.js may transfer/detach the byte buffer while parsing.
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const parsed = await readPdfDocument(raw, req.signal);
    pages = parsed.pages;
    document = { sha256, pageCount: parsed.pageCount,
      analyzedPages: parsed.analyzedPages, truncated: parsed.truncated, inputKind: "pdf" };
  } else {
    const text = String(form.get("text") || "").trim().slice(0, 60000);
    if (text.length < 30) throw new DocumentError("DESCRIPTION_REQUIRED", 422, "Describe the technical functions in a few sentences, or upload a readable PDF.");
    pages = [{ page: 1, text }];
    document = { sha256: createHash("sha256").update(text).digest("hex"), pageCount: 1,
      analyzedPages: [1], truncated: false, inputKind: "description" };
  }
  if (pages.map(p => p.text).join(" ").trim().length < 30)
    throw new DocumentError("SCANNED_PDF", 422, "This PDF has no readable text layer. Use its text-based publication PDF or paste OCR text. No patent search was completed.");
  return { form, pages, document };
}
