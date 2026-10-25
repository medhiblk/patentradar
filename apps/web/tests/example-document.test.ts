import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { loadExampleDocument } from "../src/lib/demo/example-document";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("opens the actual sample PDF bytes as a usable engineering source", async () => {
  const bytes = readFileSync("public/examples/mechanical-assembly.pdf");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
  const file = await loadExampleDocument();
  expect(file.name).toBe("example-mounting-plate.pdf");
  expect(file.type).toBe("application/pdf");
  expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes);
});
it.each([200, 404])(
  "rejects an HTML error page instead of opening a broken source (HTTP %s)",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Error</html>", { status })),
    );
    await expect(loadExampleDocument()).rejects.toThrow(
      status === 200 ? "not a valid PDF" : "HTTP 404",
    );
  },
);
it("bounds a stalled preload even when the caller supplies its own cancellation signal", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    ),
  );
  const controller = new AbortController();
  const rejected = expect(
    loadExampleDocument(controller.signal),
  ).rejects.toThrow("took too long");
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
  expect(controller.signal.aborted).toBe(false);
});
