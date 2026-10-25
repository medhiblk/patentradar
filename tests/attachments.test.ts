import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { POST as vault, GET as workspace } from "../src/app/api/vault/route";
import { POST as upload, GET as list } from "../src/app/api/attachments/route";
import {
  GET as download,
  DELETE as remove,
} from "../src/app/api/attachments/[id]/route";
import { validatedFile } from "../src/lib/platform/attachments";
const req = (body: object, cookie?: string) =>
  new Request("http://localhost:3000/api/vault", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
let dir = "",
  a = "",
  b = "",
  project = "",
  fileId = "",
  email = "",
  bytes: Buffer;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "patentradar-files-"));
  vi.stubEnv("PATENTRADAR_DATA_DIR", dir);
  vi.stubEnv("PRIVATE_STORAGE_BACKEND", "local");
  bytes = await readFile("tests/fixtures/mechanical-dimensions.pdf");
  email = crypto.randomUUID() + "@example.test";
  for (const person of ["a", "b"]) {
    const r = await vault(
      req({
        action: "register",
        email: person === "a" ? email : crypto.randomUUID() + "@example.test",
        password: "test-password-at-least-12",
      }),
    );
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    if (person === "a") a = cookie;
    else b = cookie;
  }
  const r = await vault(
    req(
      {
        action: "save",
        kind: "project",
        title: "Private test project",
        data: { description: "Confidential prototype notes" },
      },
      a,
    ),
  );
  project = (await r.json()).id;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});
function fileRequest(cookie = a, contents = bytes, name = "measured.pdf") {
  const form = new FormData();
  form.set("projectId", project);
  form.set(
    "file",
    new File([new Uint8Array(contents)], name, { type: "application/pdf" }),
  );
  return new Request("http://localhost:3000/api/attachments", {
    method: "POST",
    headers: { cookie },
    body: form,
  });
}
const route = (id = fileId, cookie = a) =>
  new Request(
    `http://localhost:3000/api/attachments/${id}?projectId=${project}`,
    { headers: { cookie } },
  );
const context = (id = fileId) => ({ params: Promise.resolve({ id }) });
it("stores original bytes and private metadata then downloads the identical attachment", async () => {
  const r = await upload(fileRequest());
  expect(r.status).toBe(201);
  const d = await r.json();
  fileId = d.file.id;
  expect(d.file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(d.file.status).toBe("ready");
  expect(JSON.stringify(d)).not.toContain("blob.vercel");
  const l = await list(
    new Request(`http://localhost:3000/api/attachments?projectId=${project}`, {
      headers: { cookie: a },
    }),
  );
  expect((await l.json()).files).toHaveLength(1);
  const response = await download(route(), context());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
});
it("denies anonymous access, another owner, scoped tokens and malformed identifiers", async () => {
  expect(
    (
      await download(
        new Request(
          `http://localhost:3000/api/attachments/${fileId}?projectId=${project}`,
        ),
        context(),
      )
    ).status,
  ).toBe(401);
  expect((await download(route(fileId, b), context())).status).toBe(404);
  expect((await remove(route(fileId, b), context())).status).toBe(404);
  expect((await upload(fileRequest(b))).status).toBe(404);
  const token = await (
    await vault(req({ action: "token", scope: "developer" }, a))
  ).json();
  expect(
    (
      await download(
        new Request(route().url, {
          headers: { authorization: "Bearer " + token.token },
        }),
        context(),
      )
    ).status,
  ).toBe(401);
  expect(
    (await download(route("not-a-uuid"), context("not-a-uuid"))).status,
  ).toBe(400);
});
it("rejects fake file types and oversized uploads without storing them", async () => {
  expect(
    (
      await upload(
        fileRequest(a, Buffer.from("<html>not a PDF</html>"), "fake.pdf"),
      )
    ).status,
  ).toBe(415);
  expect(() =>
    validatedFile("large.pdf", new Uint8Array(4 * 1024 * 1024 + 1)),
  ).toThrow(/4 MB/);
  expect(() => validatedFile("payload.svg", Buffer.from("<svg/>"))).toThrow(
    /supported/,
  );
});
it("preserves projects and file bytes after logout and a fresh authenticated session", async () => {
  expect((await vault(req({ action: "logout" }, a))).status).toBe(200);
  expect((await download(route(), context())).status).toBe(401);
  const login = await vault(
    req({ action: "login", email, password: "test-password-at-least-12" }),
  );
  a = login.headers.get("set-cookie")!.split(";")[0];
  const items = await (
    await workspace(
      new Request("http://localhost:3000/api/vault", {
        headers: { cookie: a },
      }),
    )
  ).json();
  expect(items.items.some((p: { id: string }) => p.id === project)).toBe(true);
  expect(
    Buffer.from(await (await download(route(), context())).arrayBuffer()),
  ).toEqual(bytes);
});
it("deletes attachments with their project and revokes subsequent downloads", async () => {
  const result = await vault(req({ action: "delete", id: project }, a));
  expect(result.status).toBe(200);
  expect((await download(route(), context())).status).toBe(404);
  const files = await readFile(path.join(dir, "patentradar.sqlite"));
  expect(files.length).toBeGreaterThan(0);
});
