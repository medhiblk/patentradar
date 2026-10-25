import { guard } from "@/lib/security";
import { extractProfile } from "@/lib/extract";
import { reserveAI } from "@/lib/platform/auth";
import { createHash } from "node:crypto";
import { documentForm, readPdfDocument, readVisionPages, requirePdf, validateDocumentFile, type PdfDocument } from "@/lib/documents/ingestion";
import { DocumentError, documentErrorResponse } from "@/lib/documents/errors";
import { extractVisualProfile } from "@/lib/documents/vision-profile";
import { identifyPatentDocument } from "@/lib/documents/patent-identification";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const form = await documentForm(req);
    const file = form.get("file");
    const consent = form.get("consent") === "true";
    let text = String(form.get("text") || "").slice(0, 60000);
    let document: PdfDocument | undefined;
    let sourceHash = "";
    if (file instanceof File) {
      validateDocumentFile(file);
      const bytes = new Uint8Array(await file.arrayBuffer());
      requirePdf(file, bytes);
      sourceHash = createHash("sha256").update(bytes).digest("hex");
      document = await readPdfDocument(bytes, req.signal);
      text = document.pages.map(page => page.text).join("\n").slice(0, 60000);
    }
    const images = await readVisionPages(form, consent, sourceHash, document?.pageCount || 0);
    const ingestion = document ? { pageCount: document.pageCount, analyzedPages: document.analyzedPages, truncated: document.truncated, sourceHash, imagePages: images.map(image => image.page) } : undefined;
    const context = String(form.get("context") || "").slice(0, 5000).trim();
    const contextOnly = text.trim().length < 30 && !!context;
    if (context) text = (text + "\n" + context).slice(0, 60000);
    if (images.length && consent && process.env.OPENAI_API_KEY) {
      await reserveAI(req);
      const visual = await extractVisualProfile(images, req.signal, document?.pages);
      return Response.json({ ...visual, ingestion,
        ...(document ? { documentIdentity: identifyPatentDocument(visual.evidence.map(page => ({ page: page.page, text: page.text, basis: page.basis }))) } : {}),
      });
    }
    if (text.trim().length < 30) {
      throw new DocumentError(document ? "SCANNED_PDF" : "NO_TECHNICAL_TEXT", 422,
          document ? "This PDF has no readable text layer. Enable configured AI processing and prepare page previews, or paste OCR text / upload a text-based PDF." : "Add at least one technical sentence or choose a readable PDF.");
    }
    if (consent && process.env.OPENAI_API_KEY) await reserveAI(req);
    const extracted = await extractProfile(text, consent);
    return Response.json({
      ...extracted,
      ...(contextOnly ? { notice: extracted.notice + " Technical features came from your entered technical context, not from a verified PDF text layer." } : {}),
      characters: text.length,
      ...(ingestion ? { ingestion } : {}),
      ...(document ? { documentIdentity: identifyPatentDocument(document.pages) } : {}),
    });
  } catch (e) {
    return documentErrorResponse(e);
  }
}
