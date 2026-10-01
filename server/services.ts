import { rateSlot } from "./rate-schedule.js";
import { barkDestination, reminderMessage } from "./notifications.js";
import { barkIconUrl } from "./bark-icons.js";
import { acquireWriteLock } from "./lock.js";
import { randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { resolve } from "node:path";
import AdmZip from "adm-zip";
import { DateTime } from "luxon";
import { Decimal } from "decimal.js";
import {
  allSubs,
  db,
  dataDir,
  get,
  set,
  settings,
  decrypt,
  transaction,
} from "./db.js";
import { events, subscriptionSchema } from "../shared/model.js";
export let maintenance = false;
let ratesPending: Promise<any> | null = null;
export async function ratesRefresh() {
  if (ratesPending) return ratesPending;
  ratesPending = (async () => {
    set("ratesStatus", { attempted: Date.now(), error: "", refreshing: true });
    try {
      const result = await fetchRates();
      set("ratesStatus", {
        attempted: Date.now(),
        error: "",
        refreshing: false,
      });
      return result;
    } catch (error) {
      set("ratesStatus", {
        attempted: Date.now(),
        error: "汇率刷新失败，继续使用已有缓存；请稍后重试",
        refreshing: false,
      });
      throw error;
    } finally {
      ratesPending = null;
    }
  })();
  return ratesPending;
}
async function fetchRates() {
  const base = settings().base;
  const r = await fetch(`https://api.frankfurter.dev/v2/rates?base=${base}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("汇率服务暂不可用");
  const rows = (await r.json()) as any[];
  const rates: Record<string, number> = {};
  let date = "";
  for (const row of rows) {
    if (row.base === base && Number.isFinite(row.rate) && row.rate > 0) {
      rates[row.quote] = new Decimal(1).div(row.rate).toNumber();
      date = row.date > date ? row.date : date;
    }
  }
  if (!Object.keys(rates).length) throw new Error("无可用汇率");
  set("rates", { base, rates, date, updated: Date.now() });
  return get("rates", {});
}
export async function bark(
  body: string,
  title = "订阅提醒",
  id?: string,
  fallbackAppUrl = "",
) {
  const s = settings();
  const encrypted = get("barkKey", "");
  if (!encrypted) throw new Error("尚未配置 Bark Key");
  let key: string;
  try {
    key = decrypt(encrypted);
  } catch {
    throw new Error("Bark 密钥不可解密，请重新配置");
  }
  const destination = barkDestination(s.barkServer, key);
  const sub = id
    ? (db.prepare("SELECT data FROM subscriptions WHERE id=?").get(id) as
        { data: string } | undefined)
    : undefined;
  const logo = sub ? JSON.parse(sub.data).logo : null;
  const icon = barkIconUrl(
    s.appUrl || fallbackAppUrl,
    logo && existsSync(resolve(dataDir, "logos", logo)) ? logo : null,
  );
  const r = await fetch(destination.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_key: destination.key,
      title,
      body,
      group: s.barkGroup,
      ...(icon ? { icon } : {}),
      ...(s.appUrl && id ? { url: `${s.appUrl}/?subscription=${id}` } : {}),
    }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!r.ok) throw new Error(`Bark HTTP ${r.status}`);
  const result = (await r.json()) as any;
  if (result.code !== 200) throw new Error("Bark 拒绝请求");
}
export async function createBackup() {
  if (maintenance) throw new Error("维护中");
  maintenance = true;
  const stamp =
      DateTime.utc().toFormat("yyyyLLdd-HHmmss") +
      "-" +
      randomUUID().slice(0, 6),
    temp = resolve(dataDir, `${stamp}.sqlite`);
  try {
    await backup(db, temp);
    const zip = new AdmZip();
    zip.addFile("app.sqlite", readFileSync(temp));
    zip.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify({ version: 1, created: new Date().toISOString() }),
      ),
    );
    for (const f of readdirSync(resolve(dataDir, "logos")))
      if (/^[a-f0-9-]+\.webp$/.test(f))
        zip.addLocalFile(resolve(dataDir, "logos", f), "logos");
    const name = stamp + ".zip";
    zip.writeZip(resolve(dataDir, "backups", name));
    const files = readdirSync(resolve(dataDir, "backups"))
      .filter((f) => f.endsWith(".zip"))
      .sort()
      .reverse();
    for (const f of files.slice(14)) rmSync(resolve(dataDir, "backups", f));
    return name;
  } finally {
    rmSync(temp, { force: true });
    maintenance = false;
  }
}
export async function restoreBackup(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  let size = 0;
  for (const e of zip.getEntries()) {
    size += e.header.size;
    if (
      size > 200 * 1024 * 1024 ||
      !/^(manifest\.json|app\.sqlite|logos\/[a-f0-9-]+\.webp)$/.test(
        e.entryName,
      )
    )
      throw new Error("备份内容不合法");
  }
  if (JSON.parse(zip.readAsText("manifest.json")).version !== 1)
    throw new Error("不支持的备份版本");
  const sqlite = zip.readFile("app.sqlite");
  if (!sqlite) throw new Error("缺少数据库");
  const id = randomUUID();
  const temp = resolve(dataDir, `restore-${id}.sqlite`);
  const stage = resolve(dataDir, `restore-${id}-logos`);
  const oldLogos = resolve(dataDir, `restore-${id}-old`);
  const liveLogos = resolve(dataDir, "logos");
  writeFileSync(temp, sqlite);
  mkdirSync(stage);
  let swapped = false;
  try {
    for (const e of zip.getEntries())
      if (e.entryName.startsWith("logos/"))
        writeFileSync(resolve(stage, e.entryName.slice(6)), e.getData());
    const source = new DatabaseSync(temp, { readOnly: true });
    try {
      const check = source.prepare("PRAGMA integrity_check").get() as any;
      if (Object.values(check)[0] !== "ok") throw new Error("数据库损坏");
      if (
        (source.prepare("SELECT max(version) v FROM migrations").get() as any)
          .v !== 1
      )
        throw new Error("数据库版本不兼容");
      for (const t of [
        "kv",
        "subscriptions",
        "categories",
        "sessions",
        "jobs",
      ]) {
        const expected = db
          .prepare(`PRAGMA table_info(${t})`)
          .all()
          .map((r: any) => r.name);
        const actual = source
          .prepare(`PRAGMA table_info(${t})`)
          .all()
          .map((r: any) => r.name);
        if (JSON.stringify(expected) !== JSON.stringify(actual))
          throw new Error("数据库结构不兼容");
      }
      for (const row of source
        .prepare("SELECT id,data FROM subscriptions")
        .all() as any[]) {
        const sub = subscriptionSchema.parse(JSON.parse(row.data));
        if (sub.id !== row.id) throw new Error("订阅标识不一致");
        if (sub.logo && !existsSync(resolve(stage, sub.logo)))
          throw new Error("备份缺少 Logo");
      }
      const config = source
        .prepare("SELECT value FROM kv WHERE key='settings'")
        .get() as any;
      if (
        config &&
        !DateTime.now().setZone(JSON.parse(config.value).timezone).isValid
      )
        throw new Error("备份时区无效");
      const admin = source
        .prepare("SELECT value FROM kv WHERE key='admin'")
        .get() as any;
      if (
        !admin ||
        !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(JSON.parse(admin.value).hash)
      )
        throw new Error("管理员数据无效");
    } finally {
      source.close();
    }
    await createBackup();
    maintenance = true;
    db.prepare("ATTACH DATABASE ? AS restored").run(temp);
    try {
      transaction(() => {
        for (const t of ["kv", "subscriptions", "categories", "jobs"])
          db.exec(
            `DELETE FROM ${t}; INSERT INTO ${t} SELECT * FROM restored.${t};`,
          );
        db.exec("DELETE FROM sessions");
        renameSync(liveLogos, oldLogos);
        try {
          renameSync(stage, liveLogos);
          swapped = true;
        } catch (error) {
          renameSync(oldLogos, liveLogos);
          throw error;
        }
      });
    } catch (error) {
      if (swapped) {
        rmSync(liveLogos, { recursive: true, force: true });
        renameSync(oldLogos, liveLogos);
        swapped = false;
      }
      throw error;
    } finally {
      db.exec("DETACH DATABASE restored");
    }
  } finally {
    maintenance = false;
    rmSync(temp, { force: true });
    rmSync(stage, { recursive: true, force: true });
    rmSync(oldLogos, { recursive: true, force: true });
  }
}

let busy = false;
export async function tick() {
  if (busy || maintenance) return;
  busy = true;
  const release = await acquireWriteLock();
  try {
    const s = settings(),
      now = DateTime.now().setZone(s.timezone),
      today = now.toISODate()!;
    if (now.hour >= 9 && s.barkEnabled) {
      for (const sub of allSubs()) {
        if (sub.kind === "lifetime") continue;
        for (const ahead of sub.reminders ?? s.reminders) {
          const date = now.plus({ days: ahead }).toISODate()!;
          for (const e of events(sub, date, date)) {
            const id = `${sub.id}:${e.date}:${ahead}:bark`;
            db.prepare(
              "INSERT OR IGNORE INTO jobs(id,data,status,next) VALUES(?,?,'pending',?)",
            ).run(
              id,
              JSON.stringify({ ...e, notificationDate: today }),
              Date.now(),
            );
          }
        }
      }
    }
    const jobs = db
      .prepare(
        "SELECT * FROM jobs WHERE status IN ('pending','retry') AND next<=?",
      )
      .all(Date.now()) as any[];
    for (const job of jobs) {
      if (maintenance) break;
      const e = JSON.parse(job.data);
      if (e.notificationDate !== today) {
        db.prepare("UPDATE jobs SET status='expired' WHERE id=?").run(job.id);
        continue;
      }
      if (!s.barkEnabled) continue;
      try {
        const message = reminderMessage(e, today, s.timezone);
        await bark(message.body, message.title, e.subscriptionId);
        db.prepare("UPDATE jobs SET status='sent',error=NULL WHERE id=?").run(
          job.id,
        );
      } catch (err) {
        const a = job.attempt + 1;
        db.prepare(
          "UPDATE jobs SET status=?,attempt=?,next=?,error=? WHERE id=?",
        ).run(
          a > 3 ? "failed" : "retry",
          a,
          Date.now() + [1, 5, 30][Math.min(a - 1, 2)] * 60000,
          (err as Error).name === "TimeoutError"
            ? "请求超时，可能已送达"
            : (err as Error).message,
          job.id,
        );
      }
    }
    if (get("lastBackup", "") !== today) {
      await createBackup();
      set("lastBackup", today);
    }
    release();
    const config = settings(),
      slot = rateSlot(config),
      cache = get("rates", {});
    const status = get("ratesStatus", {});
    if (
      slot !== null &&
      (cache.base !== config.base || !cache.updated || cache.updated < slot) &&
      (!status.attempted || status.attempted <= Date.now() - 15 * 60000)
    ) {
      try {
        await ratesRefresh();
      } catch {
        /* Retain cache and retry after 15 minutes. */
      }
    }
  } finally {
    release();
    busy = false;
  }
}
