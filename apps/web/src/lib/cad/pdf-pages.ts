import { readPdfDocument } from "../documents/ingestion";
export async function pdfTextPages(raw: Uint8Array, signal?: AbortSignal) {
  return (await readPdfDocument(raw, signal)).pages;
}
