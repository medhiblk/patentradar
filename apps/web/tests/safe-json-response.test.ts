import { expect, it } from "vitest";
import { safeJsonResponse } from "../src/lib/safe-json-response";
it("keeps HTML failure bodies out of browser parser errors", async () => {
  await expect(safeJsonResponse(new Response('<html>proxy error</html>', { status: 503 }))).rejects.toThrow("HTTP 503");
});
it("preserves action-ready authentication messages", async () => {
  await expect(safeJsonResponse(Response.json({ error: { message: "Sign in again" } }, { status: 401 }))).rejects.toThrow("Sign in again");
});
it("returns the parsed same-origin payload", async () => {
  expect(await safeJsonResponse(Response.json({ user: null, items: [] }))).toEqual({ user: null, items: [] });
});
