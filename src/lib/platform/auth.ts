import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { findSession, reserveUsage } from "./store";
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
export async function user(req: Request) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ||
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("pr_session="))
      ?.slice(11);
  if (!token) return null;
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await findSession(sessionHash(token));
  if (row?.scope === "mcp" && new URL(req.url).pathname !== "/api/mcp")
    return null;
  if (
    row?.scope === "developer" &&
    !new URL(req.url).pathname.startsWith("/api/v1/") &&
    new URL(req.url).pathname !== "/api/mcp"
  )
    return null;
  return row ? { id: row.userId, email: row.email } : null;
}
export async function requireUser(req: Request) {
  const u = await user(req);
  if (!u) throw new Error("Sign in to access your private workspace.");
  return u;
}
export async function reserveAI(req: Request) {
  const u = await requireUser(req),
    day = new Date().toISOString().slice(0, 10),
    limit = Number(process.env.AI_DAILY_CALL_LIMIT || 20);
  await reserveUsage(u.id, day, limit);
  return u;
}
