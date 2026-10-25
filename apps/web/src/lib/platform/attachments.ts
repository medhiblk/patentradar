import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { get, put, del } from "@vercel/blob";
import { z } from "zod";
import { getItem } from "./store";
import {
  blobBackend,
  mutateDocument,
  readDocument,
  keyPath,
  privateBackend,
} from "./private-store";
export const ATTACHMENT_LIMITS = {
  fileBytes: 4 * 1024 * 1024,
  accountBytes: 100 * 1024 * 1024,
  accountFiles: 50,
  projectFiles: 20,
};
export type Attachment = {
  id: string;
  projectId: string;
  name: string;
  contentType: string;
  size: number;
  sha256: string;
  createdAt: string;
  status: "pending" | "ready" | "deleting";
};
type Manifest = { files: Attachment[] };
export class AttachmentError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const uuid = (id: string) => z.uuid().parse(id);
const indexKey = (owner: string) =>
  `users/${uuid(owner)}/attachments/index.json`;
const fileKey = (owner: string, project: string, id: string) =>
  `users/${uuid(owner)}/attachments/${uuid(project)}/${uuid(id)}.bin`;
async function ownedProject(owner: string, id: string, allowDeleting = false) {
  const p = await getItem(owner, uuid(id));
  if (
    !p ||
    !["project", "assembly"].includes(p.kind) ||
    (!allowDeleting && p.data._deleting)
  )
    throw new AttachmentError(404, "Project not found.");
  return p;
}
export function validatedFile(name: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > ATTACHMENT_LIMITS.fileBytes)
    throw new AttachmentError(413, "Choose a non-empty file up to 4 MB.");
  const clean = name.replace(/[/\\\u0000-\u001f\u007f]/g, "_").slice(0, 180),
    ext = clean.split(".").pop()?.toLowerCase();
  const text = new TextDecoder().decode(bytes.slice(0, 1500));
  let contentType = "";
  if (ext === "pdf" && text.startsWith("%PDF-"))
    contentType = "application/pdf";
  else if (
    ext === "png" &&
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    contentType = "image/png";
  else if (
    ["jpg", "jpeg"].includes(ext || "") &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    contentType = "image/jpeg";
  else if (
    ["step", "stp"].includes(ext || "") &&
    /^\s*ISO-10303-21;/.test(text)
  )
    contentType = "application/step";
  else if (
    ext === "stl" &&
    ((bytes.length >= 84 &&
      84 +
        new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        ).getUint32(80, true) *
          50 ===
        bytes.length) ||
      /^\s*solid[\s\S]*facet\s+normal/i.test(text))
  )
    contentType = "model/stl";
  else if (["txt", "json"].includes(ext || "")) {
    try {
      const full = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (full.includes("\0")) throw Error();
      if (ext === "json") JSON.parse(full);
      contentType = ext === "json" ? "application/json" : "text/plain";
    } catch {}
  }
  if (!contentType)
    throw new AttachmentError(
      415,
      "File contents do not match a supported PDF, PNG, JPEG, STEP, STL, UTF-8 TXT or JSON file.",
    );
  return { name: clean, contentType };
}
function diskPath(key: string) {
  const dir =
    process.env.PATENTRADAR_DATA_DIR || path.join(process.cwd(), ".data");
  return path.join(dir, "private-files", keyPath(key));
}
async function writeBinary(key: string, bytes: Uint8Array) {
  if (blobBackend()) {
    await put(keyPath(key), Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/octet-stream",
      cacheControlMaxAge: 60,
    });
    return;
  }
  if (privateBackend() === "unavailable")
    throw Error("Private storage unavailable");
  const file = diskPath(key);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
}
async function deleteBinary(key: string) {
  if (blobBackend()) await del(keyPath(key));
  else
    try {
      await unlink(diskPath(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
}
export async function listAttachments(owner: string, projectId: string) {
  await ownedProject(owner, projectId);
  const manifest = (await readDocument<Manifest>(indexKey(owner)))?.data || {
    files: [],
  };
  return {
    files: manifest.files.filter((f) => f.projectId === projectId),
    usage: {
      bytes: manifest.files.reduce((s, f) => s + f.size, 0),
      files: manifest.files.length,
    },
    limits: ATTACHMENT_LIMITS,
    backend: privateBackend(),
  };
}
export async function saveAttachment(
  owner: string,
  projectId: string,
  file: File,
) {
  await ownedProject(owner, projectId);
  const bytes = new Uint8Array(await file.arrayBuffer()),
    validated = validatedFile(file.name, bytes);
  const item: Attachment = {
    ...validated,
    id: randomUUID(),
    projectId,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await mutateDocument<Manifest>(
    indexKey(owner),
    () => ({ files: [] }),
    (m) => {
      if (
        m.files.length >= ATTACHMENT_LIMITS.accountFiles ||
        m.files.filter((f) => f.projectId === projectId).length >=
          ATTACHMENT_LIMITS.projectFiles ||
        m.files.reduce((s, f) => s + f.size, 0) + item.size >
          ATTACHMENT_LIMITS.accountBytes
      )
        throw new AttachmentError(
          413,
          "Storage quota reached: 20 files per project, 50 files / 100 MB per account. Delete files before retrying.",
        );
      m.files.push(item);
      return m;
    },
  );
  try {
    await ownedProject(owner, projectId);
    await writeBinary(fileKey(owner, projectId, item.id), bytes);
    await ownedProject(owner, projectId);
    await mutateDocument<Manifest>(
      indexKey(owner),
      () => ({ files: [] }),
      (m) => {
        const r = m.files.find((f) => f.id === item.id);
        if (!r || r.status !== "pending") throw Error("Upload cancelled");
        r.status = "ready";
        return m;
      },
    );
    return { ...item, status: "ready" as const };
  } catch (e) {
    // Failed uploads remain visible as pending if cleanup itself fails; users can retry deletion.
    try {
      await deleteBinary(fileKey(owner, projectId, item.id));
      await mutateDocument<Manifest>(
        indexKey(owner),
        () => ({ files: [] }),
        (m) => ({ ...m, files: m.files.filter((f) => f.id !== item.id) }),
      );
    } catch {}
    throw e;
  }
}
export async function downloadAttachment(
  owner: string,
  projectId: string,
  id: string,
) {
  const { files } = await listAttachments(owner, projectId),
    item = files.find((f) => f.id === uuid(id) && f.status === "ready");
  if (!item) throw new AttachmentError(404, "File not found.");
  const key = fileKey(owner, projectId, id);
  if (blobBackend()) {
    const r = await get(keyPath(key), { access: "private", useCache: false });
    if (!r || r.statusCode !== 200)
      throw new AttachmentError(404, "File not found.");
    return { item, body: r.stream };
  }
  try {
    const bytes = await readFile(diskPath(key));
    return { item, body: new Blob([new Uint8Array(bytes)]) };
  } catch {
    throw new AttachmentError(404, "File not found.");
  }
}
export async function deleteAttachment(
  owner: string,
  projectId: string,
  id: string,
  allowDeleting = false,
) {
  await ownedProject(owner, projectId, allowDeleting);
  uuid(id);
  await mutateDocument<Manifest>(
    indexKey(owner),
    () => ({ files: [] }),
    (m) => {
      const item = m.files.find(
        (f) => f.projectId === projectId && f.id === id,
      );
      if (!item) throw new AttachmentError(404, "File not found.");
      item.status = "deleting";
      return m;
    },
  );
  await deleteBinary(fileKey(owner, projectId, id));
  await mutateDocument<Manifest>(
    indexKey(owner),
    () => ({ files: [] }),
    (m) => ({
      ...m,
      files: m.files.filter((f) => !(f.id === id && f.projectId === projectId)),
    }),
  );
}
export async function deleteProjectAttachments(
  owner: string,
  projectId: string,
) {
  await ownedProject(owner, projectId, true);
  const files =
    (await readDocument<Manifest>(indexKey(owner)))?.data.files.filter(
      (f) => f.projectId === projectId,
    ) || [];
  for (const f of files) await deleteAttachment(owner, projectId, f.id, true);
}

export function attachmentFailure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  const status =
    e instanceof AttachmentError
      ? e.status
      : e instanceof z.ZodError
        ? 400
        : /^Sign in/.test(message)
          ? 401
          : /Rate limit/.test(message)
            ? 429
            : /Concurrent update/.test(message)
              ? 409
              : 503;
  return Response.json(
    {
      error:
        e instanceof AttachmentError || status === 401 || status === 409
          ? message
          : status === 400
            ? "Invalid project or attachment identifier."
            : status === 429
              ? "Rate limit reached. Retry in a minute."
              : "Private file operation unavailable. Retry or check storage configuration.",
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
export async function attachmentForm(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new AttachmentError(400, "Choose a file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ATTACHMENT_LIMITS.fileBytes + 128 * 1024) {
        await reader.cancel();
        throw new AttachmentError(
          413,
          "Upload exceeds 4 MB plus form metadata.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") || "" },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new AttachmentError(400, "Invalid upload form.");
  }
}
