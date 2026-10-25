import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/platform/db";
import {
  user,
  requireUser,
  passwordHash,
  passwordMatches,
  sessionHash,
} from "@/lib/platform/auth";
import { guard } from "@/lib/security";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const u = user(req);
    if (!u) return Response.json({ user: null, items: [] });
    const items = db()
      .prepare(
        "SELECT id,kind,title,data,updated FROM items WHERE userId=? ORDER BY updated DESC LIMIT 100",
      )
      .all(u.id)
      .map((r) => ({ ...r, data: JSON.parse(String(r.data)) }));
    const usage = db()
      .prepare("SELECT count FROM usage WHERE userId=? AND day=?")
      .get(u.id, new Date().toISOString().slice(0, 10));
    return Response.json({
      user: u,
      items,
      usage: {
        calls: Number(usage?.count || 0),
        dailyLimit: Number(process.env.AI_DAILY_CALL_LIMIT || 20),
        unit: "AI requests; not money or purchased credits",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "Private storage unavailable. Configure a persistent server volume.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  try {
    guard(req);
    const b = await req.json();
    const action = z
      .enum(["register", "login", "logout", "save", "delete", "token"])
      .parse(b.action);
    if (action === "register" || action === "login") {
      const email = z.email().max(200).parse(b.email).toLowerCase();
      const password = z.string().min(12).max(200).parse(b.password);
      if (action === "register") {
        try {
          db()
            .prepare("INSERT INTO users VALUES(?,?,?)")
            .run(randomUUID(), email, passwordHash(password));
        } catch {
          return Response.json(
            { error: "Unable to create account with these details." },
            { status: 400 },
          );
        }
      }
      const row = db().prepare("SELECT * FROM users WHERE email=?").get(email);
      if (!row || !passwordMatches(password, String(row.password)))
        return Response.json({ error: "Invalid credentials" }, { status: 401 });
      const token = randomBytes(32).toString("hex");
      db()
        .prepare("INSERT INTO sessions(token,userId,expires) VALUES(?,?,?)")
        .run(sessionHash(token), String(row.id), Date.now() + 7 * 86400000);
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie": `pr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
          },
        },
      );
    }
    const u = requireUser(req);
    if (action === "logout") {
      const raw = req.headers.get("cookie")?.match(/pr_session=([^;]+)/)?.[1];
      if (raw)
        db()
          .prepare("DELETE FROM sessions WHERE token=?")
          .run(sessionHash(raw));
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie":
              "pr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          },
        },
      );
    }
    if (action === "token") {
      const token = randomBytes(32).toString("hex");
      db()
        .prepare(
          "INSERT INTO sessions(token,userId,expires,scope) VALUES(?,?,?,?)",
        )
        .run(
          sessionHash(token),
          u.id,
          Date.now() + 86400000,
          b.scope === "developer" ? "developer" : "mcp",
        );
      return Response.json({ ok: true, token, expiresIn: 86400 });
    }
    const id = b.id ? z.uuid().parse(b.id) : randomUUID();
    if (action === "delete")
      db().prepare("DELETE FROM items WHERE id=? AND userId=?").run(id, u.id);
    else {
      const kind = z
        .enum(["project", "assembly", "component", "watch", "report"])
        .parse(b.kind);
      const title = z.string().min(1).max(200).parse(b.title);
      const data = JSON.stringify(b.data);
      if (data.length > 3000000) throw new Error("Item too large");
      const old = db().prepare("SELECT userId FROM items WHERE id=?").get(id);
      if (old && old.userId !== u.id)
        return Response.json({ error: "Not found" }, { status: 404 });
      db()
        .prepare(
          "INSERT INTO items VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated=excluded.updated",
        )
        .run(id, u.id, kind, title, data, new Date().toISOString());
    }
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.startsWith("Sign in")
            ? e.message
            : "Check input and try again.",
      },
      { status: 400 },
    );
  }
}
