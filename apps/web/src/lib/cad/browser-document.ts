import { extractMeasured } from "./schema";
import { MAX_SOURCE_BYTES } from "./source-files";
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let engine: Promise<PdfJs> | undefined;
function pdfEngine() {
  if (!engine) {
    const url = new URL("/document-kernel/pdf.min.mjs", window.location.href)
      .href;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<PdfJs>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(Error("Local reader load timed out")),
        20000,
      );
    });
    engine = Promise.race([
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url),
      deadline,
    ])
      .finally(() => clearTimeout(timer))
      .catch(() => {
        engine = undefined;
        throw Error(
          "The local PDF reader could not be loaded. Check your connection and retry.",
        );
      });
  }
  return engine!;
}
/** Actual bounded PDF.js extraction. No canned profile or geometry replaces a failed upload. */
export async function interpretPdfLocally(file: File, goal = "") {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw Error("PDF source must be smaller than 4 MB.");
  const raw = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(raw.subarray(0, 5)) !== "%PDF-")
    throw Error("This file is not a valid PDF. Select the original document.");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const sourceHash = Array.from(hash, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const pdfjs = await pdfEngine();
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "/document-kernel/pdf.worker.min.mjs",
    window.location.href,
  ).href;
  const task = pdfjs.getDocument({
    data: raw,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const timeout = setTimeout(() => {
    void task.destroy();
  }, 20000);
  try {
    const doc = await task.promise;
    if (doc.numPages > 80)
      throw Error("PDF exceeds 80 pages. Select a shorter excerpt.");
    const pages: { page: number; text: string }[] = [];
    let total = 0;
    for (let page = 1; page <= Math.min(doc.numPages, 20); page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .slice(0, 8000);
      pages.push({ page, text });
      total += text.length;
      if (total > 60000) break;
    }
    return {
      spec: { ...extractMeasured(pages), goal },
      sourceName: file.name,
      sourceHash,
      method: "local-browser-measured-text",
      notice:
        "Upload service unavailable: this PDF was read locally on your device. Only explicit measurements were extracted. No external AI call was made.",
    };
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
