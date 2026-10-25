import { get, put, del, BlobPreconditionFailedError } from "@vercel/blob";
import { db } from "./db";
export class Conflict extends Error {}
export function privateBackend(): "blob" | "local" | "unavailable" {
  const configured = !!(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID
  );
  if (process.env.PRIVATE_STORAGE_BACKEND === "blob")
    return configured ? "blob" : "unavailable";
  if (process.env.VERCEL && !process.env.PATENTRADAR_DATA_DIR)
    return configured ? "blob" : "unavailable";
  return "local";
}
export const blobBackend = () => privateBackend() === "blob";
function keyPath(key: string) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  )
    throw Error("Invalid private storage key");
  return "patentradar/v1/" + key;
}
function localDocs() {
  const d = db();
  d.exec(
    "CREATE TABLE IF NOT EXISTS private_documents(key TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL)",
  );
  return d;
}
export async function readDocument<T>(
  key: string,
): Promise<{ data: T; version: string } | null> {
  if (blobBackend()) {
    const r = await get(keyPath(key), { access: "private", useCache: false });
    if (!r) return null;
    if (r.statusCode !== 200) throw Error("Private record unavailable");
    if (r.blob.size > 3200000) {
      await r.stream.cancel();
      throw Error("Private record too large");
    }
    const text = await new Response(r.stream).text();
    return { data: JSON.parse(text), version: r.blob.etag };
  }
  const row = localDocs()
    .prepare("SELECT value,version FROM private_documents WHERE key=?")
    .get(keyPath(key));
  return row
    ? { data: JSON.parse(String(row.value)), version: String(row.version) }
    : null;
}
export async function writeDocument(
  key: string,
  data: unknown,
  version?: string,
): Promise<void> {
  const text = JSON.stringify(data);
  if (Buffer.byteLength(text) > 3100000)
    throw Error("Private record too large");
  if (blobBackend()) {
    try {
      await put(keyPath(key), text, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: !!version,
        ifMatch: version,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return;
    } catch (e) {
      if (
        e instanceof BlobPreconditionFailedError ||
        /already exists|precondition|conditional|etag/i.test(
          e instanceof Error ? e.message : "",
        )
      )
        throw new Conflict("Concurrent update; refresh and retry.");
      throw e;
    }
  }
  const d = localDocs();
  if (version) {
    const r = d
      .prepare(
        "UPDATE private_documents SET value=?,version=version+1 WHERE key=? AND version=?",
      )
      .run(text, keyPath(key), Number(version));
    if (!r.changes) throw new Conflict("Concurrent update");
  } else {
    try {
      d.prepare("INSERT INTO private_documents VALUES(?,?,1)").run(
        keyPath(key),
        text,
      );
    } catch {
      throw new Conflict("Record already exists");
    }
  }
}
export async function deleteDocument(key: string) {
  if (blobBackend()) await del(keyPath(key));
  else
    localDocs()
      .prepare("DELETE FROM private_documents WHERE key=?")
      .run(keyPath(key));
}
export async function mutateDocument<T>(
  key: string,
  initial: () => T,
  mutate: (data: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const old = await readDocument<T>(key),
      next = mutate(old ? structuredClone(old.data) : initial());
    try {
      await writeDocument(key, next, old?.version);
      return next;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  throw new Conflict("Concurrent update; retry.");
}
export { keyPath };
