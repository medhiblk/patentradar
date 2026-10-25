import { createHash } from "node:crypto";
import { db } from "./db";
import {
  blobBackend,
  readDocument,
  writeDocument,
  deleteDocument,
  mutateDocument,
} from "./private-store";
export type Account = { id: string; email: string; password: string };
export type Session = {
  userId: string;
  email: string;
  expires: number;
  scope: "full" | "mcp" | "developer";
};
export type Item = {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  updated: string;
};
const emailKey = (email: string) =>
  "accounts/" + createHash("sha256").update(email).digest("hex") + ".json";
export async function findAccount(email: string): Promise<Account | null> {
  if (blobBackend())
    return (await readDocument<Account>(emailKey(email)))?.data || null;
  return (
    (db().prepare("SELECT * FROM users WHERE email=?").get(email) as
      | Account
      | undefined) || null
  );
}
export async function createAccount(account: Account) {
  if (blobBackend()) return writeDocument(emailKey(account.email), account);
  db()
    .prepare("INSERT INTO users VALUES(?,?,?)")
    .run(account.id, account.email, account.password);
}
export async function createSession(hash: string, data: Session) {
  if (blobBackend()) return writeDocument("sessions/" + hash + ".json", data);
  db()
    .prepare("INSERT INTO sessions(token,userId,expires,scope) VALUES(?,?,?,?)")
    .run(hash, data.userId, data.expires, data.scope);
}
export async function findSession(hash: string): Promise<Session | null> {
  if (blobBackend()) {
    const r = await readDocument<Session>("sessions/" + hash + ".json");
    return r && r.data.expires > Date.now() ? r.data : null;
  }
  const row = db()
    .prepare(
      "SELECT users.email,sessions.userId,sessions.expires,sessions.scope FROM sessions JOIN users ON users.id=sessions.userId WHERE token=? AND expires>?",
    )
    .get(hash, Date.now());
  return (row as Session | undefined) || null;
}
export async function removeSession(hash: string) {
  if (blobBackend()) await deleteDocument("sessions/" + hash + ".json");
  else db().prepare("DELETE FROM sessions WHERE token=?").run(hash);
}
const itemKey = (owner: string, id: string) =>
  `users/${owner}/items/${id}.json`;
export async function getItem(owner: string, id: string): Promise<Item | null> {
  if (blobBackend())
    return (await readDocument<Item>(itemKey(owner, id)))?.data || null;
  const r = db()
    .prepare(
      "SELECT id,kind,title,data,updated FROM items WHERE id=? AND userId=?",
    )
    .get(id, owner);
  return r ? ({ ...r, data: JSON.parse(String(r.data)) } as Item) : null;
}
export async function listItems(owner: string): Promise<Item[]> {
  if (blobBackend()) {
    const ids =
      (await readDocument<string[]>(`users/${owner}/item-ids.json`))?.data ||
      [];
    const items: Item[] = [];
    for (let i = 0; i < ids.length; i += 8) {
      const batch = await Promise.all(
        ids.slice(i, i + 8).map((id) => getItem(owner, id)),
      );
      items.push(...batch.flatMap((r) => (r ? [r] : [])));
    }
    return items.sort((a, b) => b.updated.localeCompare(a.updated));
  }
  return db()
    .prepare(
      "SELECT id,kind,title,data,updated FROM items WHERE userId=? ORDER BY updated DESC LIMIT 100",
    )
    .all(owner)
    .map((r) => ({ ...r, data: JSON.parse(String(r.data)) })) as Item[];
}
export async function saveItem(owner: string, item: Item, existing: boolean) {
  if (blobBackend()) {
    const old = await readDocument<Item>(itemKey(owner, item.id));
    if (existing && !old) throw Error("Not found");
    // A bounded per-user index reserves project ids atomically across concurrent requests.
    await mutateDocument<string[]>(
      `users/${owner}/item-ids.json`,
      () => [],
      (ids) => {
        if (!ids.includes(item.id)) {
          if (ids.length >= 100)
            throw Error("Maximum 100 saved items per account");
          ids.push(item.id);
        }
        return ids;
      },
    );
    await writeDocument(itemKey(owner, item.id), item, old?.version);
    return;
  }
  const old = db().prepare("SELECT userId FROM items WHERE id=?").get(item.id);
  if ((old && old.userId !== owner) || (existing && !old))
    throw Error("Not found");
  db()
    .prepare(
      "INSERT INTO items VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated=excluded.updated",
    )
    .run(
      item.id,
      owner,
      item.kind,
      item.title,
      JSON.stringify(item.data),
      item.updated,
    );
}
export async function deleteItem(owner: string, id: string) {
  if (blobBackend()) {
    await deleteDocument(itemKey(owner, id));
    await mutateDocument<string[]>(
      `users/${owner}/item-ids.json`,
      () => [],
      (ids) => ids.filter((v) => v !== id),
    );
  } else
    db().prepare("DELETE FROM items WHERE id=? AND userId=?").run(id, owner);
}
export async function usageCount(owner: string, day: string): Promise<number> {
  if (blobBackend())
    return (
      (
        await readDocument<{ count: number }>(
          `users/${owner}/usage/${day}.json`,
        )
      )?.data.count || 0
    );
  return Number(
    db()
      .prepare("SELECT count FROM usage WHERE userId=? AND day=?")
      .get(owner, day)?.count || 0,
  );
}
export async function reserveUsage(owner: string, day: string, limit: number) {
  if (blobBackend()) {
    await mutateDocument<{ count: number }>(
      `users/${owner}/usage/${day}.json`,
      () => ({ count: 0 }),
      (d) => {
        if (d.count >= limit) throw Error("Daily AI call allowance reached.");
        d.count++;
        return d;
      },
    );
    return;
  }
  if (
    !db()
      .prepare(
        "INSERT INTO usage VALUES(?,?,1) ON CONFLICT(userId,day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
      )
      .get(owner, day, limit)
  )
    throw Error("Daily AI call allowance reached.");
}
