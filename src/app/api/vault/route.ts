import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import {
  user,
  requireUser,
  passwordHash,
  passwordMatches,
  sessionHash,
} from "@/lib/platform/auth";
import * as store from "@/lib/platform/store";
import { privateBackend, Conflict } from "@/lib/platform/private-store";
import { deleteProjectAttachments } from "@/lib/platform/attachments";
import { guard } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    guard(req, "account-read", 60);
    const u = await user(req);
    if (!u)
      return Response.json(
        { user: null, items: [], storage: { backend: privateBackend() } },
        { headers },
      );
    return Response.json(
      {
        user: u,
        items: await store.listItems(u.id),
        usage: {
          calls: await store.usageCount(
            u.id,
            new Date().toISOString().slice(0, 10),
          ),
          dailyLimit: Number(process.env.AI_DAILY_CALL_LIMIT || 20),
          unit: "AI requests; not money or purchased credits",
        },
        storage: { backend: privateBackend() },
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        error:
          "Private storage unavailable. Configure private Blob storage or a persistent server volume.",
      },
      { status: 503, headers },
    );
  }
}
export async function POST(req: Request) {
  try {
    guard(req, "account-write", 20);
    if (Number(req.headers.get("content-length") || 0) > 3200000)
      return Response.json(
        { error: "Request exceeds 3.2 MB." },
        { status: 413, headers },
      );
    const b = await req.json(),
      action = z
        .enum(["register", "login", "logout", "save", "delete", "token"])
        .parse(b.action);
    if (action === "register" || action === "login") {
      const email = z.email().max(200).parse(b.email).toLowerCase(),
        password = z.string().min(12).max(200).parse(b.password);
      if (action === "register") {
        try {
          await store.createAccount({
            id: randomUUID(),
            email,
            password: passwordHash(password),
          });
        } catch {
          return Response.json(
            { error: "Unable to create account with these details." },
            { status: 400, headers },
          );
        }
      }
      const row = await store.findAccount(email);
      if (!row || !passwordMatches(password, row.password))
        return Response.json(
          { error: "Invalid credentials" },
          { status: 401, headers },
        );
      const token = randomBytes(32).toString("hex");
      await store.createSession(sessionHash(token), {
        userId: row.id,
        email: row.email,
        expires: Date.now() + 7 * 86400000,
        scope: "full",
      });
      return Response.json(
        { ok: true },
        {
          headers: {
            ...headers,
            "Set-Cookie": `pr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
          },
        },
      );
    }
    const u = await requireUser(req);
    if (action === "logout") {
      const raw = req.headers.get("cookie")?.match(/pr_session=([^;]+)/)?.[1];
      if (raw) await store.removeSession(sessionHash(raw));
      return Response.json(
        { ok: true },
        {
          headers: {
            ...headers,
            "Set-Cookie":
              "pr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          },
        },
      );
    }
    if (action === "token") {
      const token = randomBytes(32).toString("hex");
      await store.createSession(sessionHash(token), {
        userId: u.id,
        email: u.email,
        expires: Date.now() + 86400000,
        scope: b.scope === "developer" ? "developer" : "mcp",
      });
      return Response.json({ ok: true, token, expiresIn: 86400 }, { headers });
    }
    const existing = !!b.id,
      id = existing ? z.uuid().parse(b.id) : randomUUID(),
      old = existing ? await store.getItem(u.id, id) : null;
    if (existing && !old)
      return Response.json({ error: "Not found" }, { status: 404, headers });
    if (action === "delete") {
      if (old && ["project", "assembly"].includes(old.kind)) {
        await store.saveItem(
          u.id,
          { ...old, data: { ...old.data, _deleting: true } },
          true,
        );
        await deleteProjectAttachments(u.id, id);
      }
      await store.deleteItem(u.id, id);
    } else {
      if (old?.data._deleting)
        return Response.json(
          { error: "Project deletion is pending; retry deletion." },
          { status: 409, headers },
        );
      const kind = z
          .enum(["project", "assembly", "component", "watch", "report"])
          .parse(b.kind),
        title = z.string().trim().min(1).max(200).parse(b.title),
        data = z.record(z.string(), z.unknown()).parse(b.data);
      if (Buffer.byteLength(JSON.stringify(data)) > 3000000)
        throw Error("Item too large");
      if (old && old.kind !== kind) throw Error("Item type cannot change");
      await store.saveItem(
        u.id,
        { id, kind, title, data, updated: new Date().toISOString() },
        existing,
      );
    }
    return Response.json({ ok: true, id }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const signIn = message.startsWith("Sign in");
    return Response.json(
      {
        error: signIn
          ? message
          : e instanceof Conflict
            ? "Concurrent update; refresh and retry."
            : "Check input and try again.",
      },
      {
        status: signIn
          ? 401
          : e instanceof Conflict
            ? 409
            : /Rate limit/.test(message)
              ? 429
              : 400,
        headers,
      },
    );
  }
}
