import { DOCUMENT_LIMITS as limits } from "./limits";
import { DocumentError } from "./errors";

export type DocumentPage = { page: number; text: string };
export type PdfDocument = {
  pages: DocumentPage[];
  pageCount: number;
  analyzedPages: number[];
  truncated: boolean;
};

/** Enforce the actual streamed byte count, including requests without Content-Length. */
export async function documentForm(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType))
    throw new DocumentError("INVALID_DOCUMENT_FORM", 400, "Send the document using the file chooser or a multipart upload.");
  if (Number(request.headers.get("content-length") || 0) > limits.bodyBytes)
    throw new DocumentError("DOCUMENT_TOO_LARGE", 413, "The document and page previews exceed the upload limit. Use a smaller PDF excerpt.");
  const reader = request.body?.getReader();
  if (!reader) throw new DocumentError("EMPTY_DOCUMENT", 400, "Choose a document or enter a technical description.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let stop!: (error: DocumentError) => void;
  const interrupted = new Promise<never>((_resolve, reject) => { stop = reject; });
  const abort = () => {
    stop(new DocumentError("CANCELLED", 499, "Document upload was cancelled. Your source has been kept."));
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(() => {
    stop(new DocumentError("UPLOAD_TIMEOUT", 408, "Document upload timed out. Retry using a smaller excerpt."));
    void reader.cancel().catch(() => {});
  }, limits.timeoutMs);
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    if (request.signal.aborted) abort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      size += value.byteLength;
      if (size > limits.bodyBytes) {
        await reader.cancel();
        throw new DocumentError("DOCUMENT_TOO_LARGE", 413, "The document and page previews exceed the upload limit. Use a smaller PDF excerpt.");
      }
      chunks.push(value);
    }
    try {
      return await Promise.race([new Request(request.url, {
        method: "POST", headers: { "content-type": contentType }, body: Buffer.concat(chunks),
      }).formData(), interrupted]);
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      throw new DocumentError("INVALID_DOCUMENT_FORM", 400, "The upload form could not be read. Select the original document and retry.");
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export function validateDocumentFile(file: File) {
  if (!file.size) throw new DocumentError("EMPTY_DOCUMENT", 400, "This file is empty. Choose the original document.");
  if (file.size > limits.fileBytes)
    throw new DocumentError("DOCUMENT_TOO_LARGE", 413, "Source files must be smaller than 4 MB.");
}

export const pdfSignature = (bytes: Uint8Array) =>
  bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";

export function requirePdf(file: Pick<File, "name" | "type">, bytes: Uint8Array) {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf")
    throw new DocumentError("INVALID_PDF", 415, "Choose an original PDF file with a valid PDF signature.");
  if (!pdfSignature(bytes))
    throw new DocumentError("INVALID_PDF", 400, "The selected file has an invalid PDF signature. Choose the original PDF.");
}

/** Shared bounded PDF extraction for patent and engineering journeys. No OCR or AI is implied. */
export async function readPdfDocument(raw: Uint8Array, signal?: AbortSignal): Promise<PdfDocument> {
  if (!pdfSignature(raw)) throw new DocumentError("INVALID_PDF", 400, "The selected file has an invalid PDF signature. Choose the original PDF.");
  if (raw.length > limits.fileBytes) throw new DocumentError("DOCUMENT_TOO_LARGE", 413, "PDF source must be smaller than 4 MB.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: raw, useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  let stop!: (error: DocumentError) => void;
  const interrupted = new Promise<never>((_resolve, reject) => { stop = reject; });
  const abort = () => {
    stop(new DocumentError("CANCELLED", 499, "Document reading was cancelled. Your source has been kept."));
    void task.destroy().catch(() => {});
  };
  const timer = setTimeout(() => {
    stop(new DocumentError("PDF_TIMEOUT", 503, "This PDF took too long to read. Retry with a smaller excerpt."));
    void task.destroy().catch(() => {});
  }, limits.timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) abort();
    const doc = await Promise.race([task.promise, interrupted]);
    if (doc.numPages > limits.pages)
      throw new DocumentError("PDF_PAGE_LIMIT", 413, "PDF exceeds 80 pages. Select a shorter excerpt.");
    const pages: DocumentPage[] = [];
    let total = 0, textCropped = false;
    for (let page = 1; page <= Math.min(doc.numPages, limits.textPages); page++) {
      const pdfPage = await Promise.race([doc.getPage(page), interrupted]);
      const content = await Promise.race([pdfPage.getTextContent(), interrupted]);
      const fullText = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      const text = fullText.slice(0, Math.min(limits.pageCharacters, limits.textCharacters - total));
      textCropped ||= text.length < fullText.length;
      pages.push({ page, text });
      total += text.length;
      pdfPage.cleanup();
      if (total >= limits.textCharacters) break;
    }
    return { pages, pageCount: doc.numPages, analyzedPages: pages.map(p => p.page), truncated: textCropped || pages.length < doc.numPages || total >= limits.textCharacters };
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    if (error instanceof Error && error.name === "PasswordException")
      throw new DocumentError("ENCRYPTED_PDF", 422, "This PDF is password-protected. Upload an unlocked copy you are authorized to use.");
    throw new DocumentError("UNREADABLE_PDF", 422, "This PDF could not be read. It may be damaged or unsupported; export a new PDF and retry.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => {});
  }
}

function imageDimensions(bytes: Uint8Array, mime: string): [number, number] | undefined {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png" && b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.subarray(12,16).toString() === "IHDR")
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (mime === "image/jpeg" && b.length > 4 && b[0] === 255 && b[1] === 216) {
    let offset = 2;
    while (offset + 4 < b.length) {
      if (b[offset] !== 255) break;
      const marker = b[offset + 1];
      if (marker === 217 || marker === 218) break;
      const length = b.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > b.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 7)
        return [b.readUInt16BE(offset + 7), b.readUInt16BE(offset + 5)];
      offset += 2 + length;
    }
  }
}

export type VisionPage = { page: number; image: string; mime: "image/png" | "image/jpeg" };
// The hash guards accidental stale previews. Client-supplied pixels are not server-attested
// copies of a PDF page, so downstream evidence must always remain visual-unverified.
export async function readVisionPages(form: FormData, consent: boolean, sourceHash: string, pageCount: number): Promise<VisionPage[]> {
  const files = form.getAll("pdfPageImage");
  if (!files.length) return [];
  if (!consent) throw new DocumentError("CONSENT_REQUIRED", 403, "Approve external AI processing before submitting PDF page previews.");
  if (!sourceHash || form.get("pdfSourceHash") !== sourceHash)
    throw new DocumentError("VISION_SOURCE_MISMATCH", 400, "The page previews no longer match the selected PDF. Reselect the source and retry.");
  let numbers: unknown;
  try { numbers = JSON.parse(String(form.get("pdfImagePages") || "")); } catch { /* rejected below */ }
  if (!Array.isArray(numbers) || numbers.length !== files.length || numbers.length > limits.visionPages || new Set(numbers).size !== numbers.length || numbers.some(n => !Number.isInteger(n) || n < 1 || n > Math.min(pageCount, limits.textPages)))
    throw new DocumentError("INVALID_PAGE_PREVIEWS", 400, "Choose up to four valid PDF page previews from the first 20 pages.");
  const pageNumbers = numbers as number[];
  return Promise.all(files.map(async (file, index) => {
    if (!(file instanceof File) || !file.size || file.size > limits.visionImageBytes || !["image/png", "image/jpeg"].includes(file.type))
      throw new DocumentError("INVALID_PAGE_PREVIEWS", 400, "PDF page previews must be bounded PNG or JPEG images.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const size = imageDimensions(bytes, file.type);
    if (!size || !size[0] || !size[1] || size[0] * size[1] > limits.visionPixels)
      throw new DocumentError("INVALID_PAGE_PREVIEWS", 400, "PDF page previews have an invalid image format or exceed the pixel limit.");
    return { page: pageNumbers[index], image: Buffer.from(bytes).toString("base64"), mime: file.type as VisionPage["mime"] };
  }));
}
