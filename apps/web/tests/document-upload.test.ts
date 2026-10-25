import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { studioRequest } from "../src/lib/cad/studio-request";
import { sourceFileError } from "../src/lib/cad/source-files";
import { POST as interpret } from "../src/app/api/cad/interpret/route";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("retains multipart file uploads without a manually invented content-type boundary", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetch);
  const form = new FormData();
  form.set("file", new File(["%PDF-test"], "source.pdf"));
  expect(await studioRequest("/api/cad/interpret", form)).toEqual({ ok: true });
  expect(fetch.mock.calls[0][1].body).toBe(form);
  expect(fetch.mock.calls[0][1].headers).toBeUndefined();
});
it("classifies HTML gateway failures as recoverable without exposing the HTML or native JSON error", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>PRIVATE_RESPONSE_BODY</html>", { status: 503 }),
      ),
  );
  try {
    await studioRequest("/api/cad/interpret", {});
    expect.unreachable();
  } catch (error) {
    expect(error).toMatchObject({ status: 503, recoverable: true });
    expect((error as Error).message).toContain("HTTP 503");
    expect((error as Error).message).not.toMatch(
      /PRIVATE_RESPONSE_BODY|expected pattern/,
    );
  }
});
it.each([401, 403, 413, 429])(
  "does not silently bypass an HTTP %s refusal",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Error</html>", { status })),
    );
    await expect(studioRequest("/api/cad/interpret", {})).rejects.toMatchObject(
      { status, recoverable: false },
    );
  },
);
it("recognizes a PDF file-provider MIME type without depending on a filename suffix", () => {
  expect(
    sourceFileError({
      name: "Scanned document",
      size: 123,
      type: "application/pdf",
    }),
  ).toBeUndefined();
  expect(
    sourceFileError({ name: "drawing.pdf", size: 5 * 1024 * 1024 }),
  ).toContain("4 MB");
  expect(sourceFileError({ name: "empty.pdf", size: 0 })).toContain("empty");
});
it("extracts the downloaded sample when a file provider supplies no PDF MIME type", async () => {
  const raw = readFileSync("public/examples/mechanical-assembly.pdf");
  const form = new FormData();
  form.set(
    "file",
    new File([raw], "downloaded-source.pdf", {
      type: "application/octet-stream",
    }),
  );
  form.set("consent", "false");
  const response = await interpret(
    new Request("https://app.example/api/cad/interpret", {
      method: "POST",
      body: form,
    }),
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe("local-measured-text");
  expect(data.spec.components[0].dimensions).toMatchObject({
    length: 80,
    width: 50,
    height: 6,
  });
  expect(data.spec.components[0].sourcePage).toBe(1);
});
