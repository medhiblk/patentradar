import { beforeEach, afterEach, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  objects: new Map<string, { bytes: Uint8Array; etag: string }>(),
  revision: 0,
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: fake.get,
    put: fake.put,
    del: fake.del,
  };
});
import { POST as vault, GET as workspace } from "../src/app/api/vault/route";
import { POST as upload } from "../src/app/api/attachments/route";
import {
  GET as download,
  DELETE as remove,
} from "../src/app/api/attachments/[id]/route";
import {
  mutateDocument,
  readDocument,
  Conflict,
} from "../src/lib/platform/private-store";
import { saveItem, mutateItem, getItem } from "../src/lib/platform/store";
const req = (body: object, cookie?: string) =>
  new Request("https://app.example/api/vault", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  fake.objects.clear();
  fake.revision = 0;
  vi.stubEnv("PRIVATE_STORAGE_BACKEND", "blob");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fixture-only-not-a-real-token");
  fake.get.mockImplementation(
    async (key: string, options: { access: string; useCache: boolean; headers?: Record<string, string> }) => {
      expect(options).toMatchObject({
        access: "private",
        useCache: false,
      });
      if (key.endsWith(".json"))
        expect(options.headers).toEqual({ "Accept-Encoding": "identity" });
      const row = fake.objects.get(key);
      return row
        ? {
            statusCode: 200,
            stream: new Blob([row.bytes as Uint8Array<ArrayBuffer>]).stream(),
            blob: {
              etag: options.headers?.["Accept-Encoding"] === "identity" ? row.etag : "W/" + row.etag,
              size: row.bytes.length,
            },
          }
        : null;
    },
  );
  fake.put.mockImplementation(
    async (
      key: string,
      body: string | Uint8Array,
      options: { access: string; allowOverwrite?: boolean; ifMatch?: string },
    ) => {
      expect(options.access).toBe("private");
      const old = fake.objects.get(key);
      if (
        (options.ifMatch && old?.etag !== options.ifMatch) ||
        (old && !options.allowOverwrite && !options.ifMatch)
      )
        throw new Conflict("Concurrent update");
      const bytes =
        typeof body === "string"
          ? new TextEncoder().encode(body)
          : new Uint8Array(body);
      fake.objects.set(key, { bytes, etag: String(++fake.revision) });
      return { etag: String(fake.revision) };
    },
  );
  fake.del.mockImplementation(async (key: string) => {
    fake.objects.delete(key);
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("updates a substantial private research document using its strong storage version", async () => {
  const key = "verification/large-research.json";
  await mutateDocument(key, () => ({ text: "Reports “Abandoned” · technical evidence. ".repeat(500), reviewed: false }), (document) => document);
  await mutateDocument(key, () => ({ text: "", reviewed: false }), (document) => ({ ...document, reviewed: true }));
  expect((await readDocument<{ reviewed: boolean }>(key))?.data.reviewed).toBe(true);
});
it("retries concurrent private item mutations without losing either review field", async () => {
  const owner = "fixture-owner", id = "fixture-watch";
  await saveItem(owner, { id, kind: "watch", title: "Fixture watch", updated: "2026-10-25T00:00:00Z", data: { reviewed: false, checked: false } }, false);
  await Promise.all([
    mutateItem(owner, id, item => ({ ...item, data: { ...item.data, reviewed: true } })),
    mutateItem(owner, id, item => ({ ...item, data: { ...item.data, checked: true } })),
  ]);
  expect((await getItem(owner, id))?.data).toMatchObject({ reviewed: true, checked: true });
  await expect(mutateItem("different-owner", id, item => item)).rejects.toThrow("Not found");
});
it("persists private accounts, sessions, projects and attachments without SQLite on the cloud backend", async () => {
  const signup = await vault(
    req({
      action: "register",
      email: "blob-user@example.test",
      password: "test-password-at-least-12",
    }),
  );
  expect(signup.status).toBe(200);
  const cookie = signup.headers.get("set-cookie")!.split(";")[0];
  expect(signup.headers.get("set-cookie")).toContain("Secure");
  const saved = await (
    await vault(
      req(
        { action: "save", kind: "project", title: "Cloud project", data: {} },
        cookie,
      ),
    )
  ).json();
  const form = new FormData();
  form.set("projectId", saved.id);
  form.set(
    "file",
    new File(["A private technical note."], "spec.txt", { type: "text/plain" }),
  );
  const stored = await upload(
    new Request("https://app.example/api/attachments", {
      method: "POST",
      headers: { cookie },
      body: form,
    }),
  );
  expect(stored.status).toBe(201);
  const file = (await stored.json()).file;
  const context = { params: Promise.resolve({ id: file.id }) };
  const url = `https://app.example/api/attachments/${file.id}?projectId=${saved.id}`;
  expect(
    await (
      await download(new Request(url, { headers: { cookie } }), context)
    ).text(),
  ).toBe("A private technical note.");
  await vault(req({ action: "logout" }, cookie));
  expect(
    (await download(new Request(url, { headers: { cookie } }), context)).status,
  ).toBe(401);
  const login = await vault(
    req({
      action: "login",
      email: "blob-user@example.test",
      password: "test-password-at-least-12",
    }),
  );
  const fresh = login.headers.get("set-cookie")!.split(";")[0];
  const portfolio = await (
    await workspace(
      new Request("https://app.example/api/vault", {
        headers: { cookie: fresh },
      }),
    )
  ).json();
  expect(portfolio.storage.backend).toBe("blob");
  expect(portfolio.items[0].id).toBe(saved.id);
  expect(
    (await remove(new Request(url, { headers: { cookie: fresh } }), context))
      .status,
  ).toBe(200);
  const plaintext = [...fake.objects.values()]
    .map((r) => new TextDecoder().decode(r.bytes))
    .join("");
  expect(plaintext).not.toContain("test-password-at-least-12");
});
it("serializes concurrent manifest changes with conditional writes instead of losing entries", async () => {
  const result = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) =>
      mutateDocument<number[]>(
        "test/counter.json",
        () => [],
        (d) => [...d, i],
      ),
    ),
  );
  expect(result.every((r) => r.status === "fulfilled")).toBe(true);
  expect(
    (await readDocument<number[]>("test/counter.json"))?.data.sort(),
  ).toEqual([0, 1, 2, 3]);
});
it("keeps concurrent uploads within the project quota", async () => {
  const signed = await vault(
    req({
      action: "register",
      email: "quota-user@example.test",
      password: "quota-test-password-at-least-12",
    }),
  );
  const cookie = signed.headers.get("set-cookie")!.split(";")[0];
  const saved = await (
    await vault(
      req(
        { action: "save", kind: "project", title: "Quota project", data: {} },
        cookie,
      ),
    )
  ).json();
  const profile = await (
    await workspace(
      new Request("https://app.example/api/vault", { headers: { cookie } }),
    )
  ).json();
  const owner = profile.user.id;
  const key = `users/${owner}/attachments/index.json`;
  await mutateDocument<{ files: unknown[] }>(
    key,
    () => ({ files: [] }),
    () => ({
      files: Array.from({ length: 19 }, () => ({
        id: crypto.randomUUID(),
        projectId: saved.id,
        name: "Fixture prior file",
        contentType: "text/plain",
        size: 1,
        sha256: "fixture",
        createdAt: new Date().toISOString(),
        status: "ready",
      })),
    }),
  );
  const requests = Array.from({ length: 2 }, () => {
    const f = new FormData();
    f.set("projectId", saved.id);
    f.set("file", new File(["test"], "source.txt"));
    return upload(
      new Request("https://app.example/api/attachments", {
        method: "POST",
        headers: { cookie },
        body: f,
      }),
    );
  });
  const result = await Promise.all(requests);
  expect(result.map((r) => r.status).sort()).toEqual([201, 413]);
  expect(
    (await readDocument<{ files: unknown[] }>(key))?.data.files,
  ).toHaveLength(20);
});
