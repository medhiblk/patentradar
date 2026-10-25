import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
export const sessionHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
export function user(req: Request) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ||
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("pr_session="))
      ?.slice(11);
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT users.id,users.email,sessions.scope FROM sessions JOIN users ON users.id=sessions.userId WHERE token=? AND expires>?",
    )
    .get(sessionHash(token), Date.now());
  if (row?.scope === "mcp" && new URL(req.url).pathname !== "/api/mcp")
    return null;
  if (
    row?.scope === "developer" &&
    !new URL(req.url).pathname.startsWith("/api/v1/") &&
    new URL(req.url).pathname !== "/api/mcp"
  )
    return null;
  return row as { id: string; email: string } | undefined;
}
export function requireUser(req: Request) {
  const u = user(req);
  if (!u) throw new Error("Sign in to access your private workspace.");
  return u;
}
export function reserveAI(req: Request) {
  const u = requireUser(req),
    day = new Date().toISOString().slice(0, 10),
    limit = Number(process.env.AI_DAILY_CALL_LIMIT || 20);
  const result = db()
    .prepare(
      "INSERT INTO usage VALUES(?,?,1) ON CONFLICT(userId,day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
    )
    .get(u.id, day, limit);
  if (!result) throw new Error("Daily AI call allowance reached.");
  return u;
}
