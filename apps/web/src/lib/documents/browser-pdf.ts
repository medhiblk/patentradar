import { browserPdfEngine } from "../cad/browser-document";
import { DOCUMENT_LIMITS as limits } from "./limits";

/** Render actual pages locally. Call only after the user's external-AI consent.
 * This function makes no AI/provider call and retains the original PDF in the form.
 * Optional page selection is 1-based and limited to the first 20 pages.
 */
export async function preparePdfVision(
  form: FormData,
  file: File,
  signal?: AbortSignal,
  requestedPages?: number[],
): Promise<{ renderedPages: number[]; notice?: string }> {
  if (form.get("consent") !== "true")
    throw Error("Approve external AI processing before preparing PDF page previews.");
  if (!file.size || file.size > limits.fileBytes)
    throw Error("Choose a non-empty PDF smaller than 4 MB.");
  const raw = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(raw.subarray(0, 5)) !== "%PDF-")
    throw Error("The selected source is not a valid PDF.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const sourceHash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  // Reserve multipart headers and all existing fields, not only the file bytes.
  let used = 24 * 1024;
  for (const [key, value] of form.entries()) {
    if (["pdfPageImage", "pdfImagePages", "pdfSourceHash"].includes(key)) continue;
    used += value instanceof Blob ? value.size : new TextEncoder().encode(value).byteLength;
    used += 1024;
  }
  const available = limits.bodyBytes - used;
  if (available < 48000)
    return { renderedPages: [], notice: "The PDF leaves no space for readable page previews. Use a smaller excerpt for scanned-PDF AI analysis." };
  const pdfjs = await browserPdfEngine();
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("/document-kernel/pdf.worker.min.mjs", window.location.href).href;
  const task = pdfjs.getDocument({ data: raw, useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  let stop!: (error: Error) => void;
  const interrupted = new Promise<never>((_resolve, reject) => { stop = reject; });
  let activeRender: { cancel: () => void } | undefined;
  const cancel = (message: string) => {
    stop(Error(message));
    activeRender?.cancel();
    void task.destroy().catch(() => {});
  };
  const abort = () => cancel("PDF preview preparation was cancelled. Your source has been kept.");
  const timeout = setTimeout(() => cancel("PDF page previews took too long to prepare. Use a smaller excerpt."), limits.timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) abort();
    const doc = await Promise.race([task.promise, interrupted]);
    if (doc.numPages > limits.pages) throw Error("PDF exceeds 80 pages. Select a shorter excerpt.");
    const requested = requestedPages || Array.from({ length: Math.min(doc.numPages, limits.visionPages) }, (_, i) => i + 1);
    if (!requested.length || requested.length > limits.visionPages || new Set(requested).size !== requested.length || requested.some(n => !Number.isInteger(n) || n < 1 || n > Math.min(doc.numPages, limits.textPages)))
      throw Error("Select up to four valid PDF pages from the first 20 pages.");
    const count = Math.min(requested.length, Math.floor(available / 48000));
    const images: { page: number; image: Blob }[] = [];
    const imageBudget = Math.min(limits.visionImageBytes, Math.floor(available / count));
    for (const pageNumber of requested.slice(0, count)) {
      const page = await Promise.race([doc.getPage(pageNumber), interrupted]);
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / Math.max(original.width, original.height), Math.sqrt(limits.visionPixels / (original.width * original.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw Error("This browser could not render the selected PDF page.");
      try {
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        const render = page.render({ canvasContext: context, viewport });
        activeRender = render;
        await Promise.race([render.promise, interrupted]);
        activeRender = undefined;
        let image: Blob | null = null;
        for (const quality of [0.8, 0.65, 0.5]) {
          image = await Promise.race([new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality)), interrupted]);
          if (image && image.size <= imageBudget) break;
        }
        if (!image || image.size > imageBudget)
          throw Error("A PDF page preview exceeds the upload budget. Use a smaller PDF excerpt or select fewer pages.");
        images.push({ page: pageNumber, image });
      } finally {
        activeRender = undefined;
        canvas.width = 0; canvas.height = 0;
        page.cleanup();
      }
    }
    // Install atomically after every render succeeded; retries never duplicate previews.
    form.delete("pdfPageImage");
    for (const image of images) form.append("pdfPageImage", image.image, `page-${image.page}.jpg`);
    form.set("pdfImagePages", JSON.stringify(images.map(image => image.page)));
    form.set("pdfSourceHash", sourceHash);
    return { renderedPages: images.map(image => image.page), ...(count < requested.length ? { notice: "Only " + count + " page previews fit the upload limit. Use a smaller PDF excerpt to include more pages." } : {}) };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException")
      throw Error("This PDF is password-protected. Upload an unlocked copy you are authorized to use.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => {});
  }
}
