import { drizzle } from "drizzle-orm/sqlite-proxy";
import { subscriptions } from "./schema.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const dataDir = resolve(process.env.DATA_DIR || "work/data");
mkdirSync(dataDir, { recursive: true });
for (const d of ["logos", "backups"])
  mkdirSync(resolve(dataDir, d), { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, "app.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories(name TEXT PRIMARY KEY,color TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,data TEXT NOT NULL,status TEXT NOT NULL,attempt INTEGER NOT NULL DEFAULT 0,next INTEGER NOT NULL,error TEXT);
INSERT OR IGNORE INTO migrations VALUES(1);
INSERT OR IGNORE INTO categories VALUES('未分类','#64748b');`);
export function get<T = any>(key: string, fallback: any): T {
  const row = db.prepare("SELECT value FROM kv WHERE key=?").get(key) as any;
  return row ? JSON.parse(row.value) : fallback;
}
export function set(key: string, value: unknown) {
  db.prepare(
    "INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, JSON.stringify(value));
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verify(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
export const defaults = {
  base: "CNY",
  timezone: "Asia/Shanghai",
  reminders: [7, 1, 0],
  ratesAutoRefresh: true,
  ratesRefreshFrequency: "daily",
  ratesRefreshTime: "09:00",
  ratesRefreshWeekday: 1,
  barkServer: "https://api.day.app",
  barkGroup: "订阅集",
  appUrl: "",
  barkEnabled: false,
};
export function settings() {
  return { ...defaults, ...get("settings", {}) };
}
export function encrypt(value: string) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("请设置 64 位十六进制 ENCRYPTION_KEY");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  return [
    iv.toString("hex"),
    cipher.update(value, "utf8", "hex") + cipher.final("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(":");
}
export function decrypt(value: string) {
  const [iv, text, tag] = value.split(":");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY || "", "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return cipher.update(text, "hex", "utf8") + cipher.final("utf8");
}
if (!get("admin", null) && process.env.INIT_ADMIN_PASSWORD) {
  if (process.env.INIT_ADMIN_PASSWORD.length < 10)
    throw new Error("初始化密码至少 10 位");
  set("admin", {
    username: process.env.INIT_ADMIN_USERNAME || "admin",
    hash: passwordHash(process.env.INIT_ADMIN_PASSWORD),
  });
}
const orm = drizzle(async (sql, params, method) => {
  const statement = db.prepare(sql);
  if (method === "run") {
    statement.run(...params);
    return { rows: [] };
  }
  return { rows: statement.all(...params).map((r) => Object.values(r)) };
});
export function allSubs() {
  const query = orm
    .select({ data: subscriptions.data })
    .from(subscriptions)
    .toSQL();
  return (db.prepare(query.sql).all(...(query.params as any[])) as any[]).map(
    (r) => JSON.parse(r.data),
  );
}
export function saveSub(s: any) {
  db.prepare(
    "INSERT INTO subscriptions VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(s.id, JSON.stringify(s));
}
export function transaction(fn: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
