export const EXAMPLE_DOCUMENT_URL = "/examples/mechanical-assembly.pdf";
/** Fetch the actual sample PDF; never replace a failed download with hardcoded geometry. */
export async function loadExampleDocument(signal?: AbortSignal): Promise<File> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);
  try {
    const response = await fetch(EXAMPLE_DOCUMENT_URL, {
      signal: controller.signal,
    });
    if (!response.ok)
      throw Error(
        "The example PDF is unavailable (HTTP " +
          response.status +
          "). Retry opening the document.",
      );
    const bytes = await response.arrayBuffer();
    if (
      bytes.byteLength > 4 * 1024 * 1024 ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
    )
      throw Error(
        "The example download was not a valid PDF. Retry opening the document.",
      );
    return new File([bytes], "example-mounting-plate.pdf", {
      type: "application/pdf",
    });
  } catch (error) {
    if (timedOut)
      throw Error(
        "The example PDF took too long to load. Check your connection and retry.",
      );
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.message.startsWith("The example"))
      throw error;
    throw Error(
      "The example PDF could not be downloaded. Check your connection and retry.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
