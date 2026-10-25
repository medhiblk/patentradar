import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
let database: DatabaseSync | undefined;
export function db() {
  if (process.env.VERCEL && !process.env.PATENTRADAR_DATA_DIR)
    throw new Error(
      "Persistent platform storage requires a configured persistent server volume.",
    );
  if (database) return database;
  const dir =
    process.env.PATENTRADAR_DATA_DIR || path.join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(
    process.env.NODE_ENV === "test" && !process.env.PATENTRADAR_DATA_DIR
      ? ":memory:"
      : path.join(dir, "patentradar.sqlite"),
  );
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,userId TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,data TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS usage(userId TEXT NOT NULL,day TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(userId,day));
 CREATE VIRTUAL TABLE IF NOT EXISTS patents USING fts5(publication UNINDEXED,title,abstract,record UNINDEXED);`);
  try {
    database.exec(
      "ALTER TABLE sessions ADD COLUMN scope TEXT NOT NULL DEFAULT 'full'",
    );
  } catch {}
  return database;
}
