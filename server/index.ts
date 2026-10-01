import { nextRateRefresh } from "./rate-schedule.js";
import { openapi } from "./openapi.js";
import { acquireWriteLock } from "./lock.js";
import { appIconName, verifyIconSignature } from "./bark-icons.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { DateTime } from "luxon";
import Papa from "papaparse";
import { z } from "zod";
import {
  db,
  get,
  set,
  settings,
  allSubs,
  saveSub,
  transaction,
  passwordHash,
  verify,
  encrypt,
  dataDir,
} from "./db.js";
import {
  events,
  convert,
  nextEvent,
  subscriptionSchema,
  major,
  minor,
  type Subscription,
} from "../shared/model.js";
import {
  maintenance,
  ratesRefresh,
  bark,
  createBackup,
  restoreBackup,
  tick,
} from "./services.js";
export const app = Fastify({
  logger: true,
  bodyLimit: 12 * 1024 * 1024,
  disableRequestLogging: true,
});
await app.register(cookie);
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});
app.setErrorHandler((err: any, req, reply) => {
  reply
    .code(err.statusCode || 400)
    .send({ error: err.validation ? "输入无效" : err.message || "操作失败" });
});
app.addHook("onSend", async (req, reply, payload) => {
  const pathname = req.url.split("?")[0];
  if (
    pathname.startsWith("/api/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  )
    reply.header("Cache-Control", "no-store");
  return payload;
});
app.addHook("onRequest", async (req, reply) => {
  const route = req.routeOptions.url || req.url;
  if (
    route.startsWith("/api/") ||
    req.url === "/sw.js" ||
    req.url === "/manifest.webmanifest"
  )
    reply.header("Cache-Control", "no-store");
  if (!route.startsWith("/api/") || route === "/api/v1/health") return;
  if (
    route === "/api/v1/bark/icons/:name" &&
    ["GET", "HEAD"].includes(req.method)
  )
    return;
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (mutating) {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host)
      return reply.code(403).send({ error: "请求来源无效" });
  }
  if (mutating) (req as any).releaseLock = await acquireWriteLock();
  if (route === "/api/v1/auth/login") return;
  const session = db
    .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
    .get(req.cookies.sid || "", Date.now()) as any;
  if (!session) return reply.code(401).send({ error: "请先登录" });
  if (mutating && req.headers["x-csrf-token"] !== session.csrf)
    return reply.code(403).send({ error: "会话校验失败" });
  (req as any).session = session;
});
app.addHook("onResponse", async (req) => {
  (req as any).releaseLock?.();
});
app.get("/api/v1/openapi.json", () => openapi);
app.get("/api/v1/health", () => ({ ok: true }));
app.post(
  "/api/v1/auth/login",
  { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
  async (req, reply) => {
    const { username, password } = z
        .object({ username: z.string(), password: z.string().max(1000) })
        .parse(req.body),
      admin = get("admin", null);
    if (!admin || username !== admin.username || !verify(password, admin.hash))
      return reply.code(401).send({
        error: admin
          ? "账号或密码不正确"
          : "请先设置 INIT_ADMIN_PASSWORD 并重启",
      });
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      token,
      csrf,
      Date.now() + 7 * 86400000,
    );
    reply.setCookie("sid", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: 604800,
    });
    return { csrf, username };
  },
);
app.get("/api/v1/auth/me", (req) => ({
  csrf: (req as any).session.csrf,
  username: get("admin", {}).username,
  avatar: get("admin", {}).avatar || "",
}));
app.put("/api/v1/auth/profile", (req) => {
  const profile = z
    .object({
      username: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[^\s\p{Cc}]+$/u, "用户名不能包含空格或控制字符"),
      avatar: z.union([z.literal(""), z.string().regex(/^[a-f0-9-]+\.webp$/)]),
    })
    .parse(req.body);
  if (profile.avatar && !existsSync(resolve(dataDir, "logos", profile.avatar)))
    throw new Error("头像不存在，请重新上传");
  set("admin", { ...get<any>("admin", {}), ...profile });
  return profile;
});
app.post("/api/v1/auth/logout", (req, reply) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.cookies.sid!);
  reply.clearCookie("sid", { path: "/" });
  return { ok: true };
});
app.post("/api/v1/auth/password", (req) => {
  const b = z
      .object({
        old: z.string(),
        password: z.string().min(10, "新密码至少 10 位").max(1000),
      })
      .parse(req.body),
    a = get("admin", null);
  if (!verify(b.old, a.hash)) throw new Error("原密码错误");
  set("admin", { ...a, hash: passwordHash(b.password) });
  db.exec("DELETE FROM sessions");
  return { ok: true };
});
app.get("/api/v1/subscriptions", () => {
  const today = DateTime.now().setZone(settings().timezone).toISODate()!;
  return allSubs().map((s) => ({ ...s, next: nextEvent(s, today) }));
});
app.post("/api/v1/subscriptions", (req) => {
  const s = { ...subscriptionSchema.parse(req.body), id: randomUUID() };
  saveSub(s);
  return s;
});
app.put("/api/v1/subscriptions/:id", (req) => {
  const id = (req.params as any).id,
    old = allSubs().find((s) => s.id === id);
  if (!old) throw new Error("订阅不存在");
  const input = req.body as any;
  let s = subscriptionSchema.parse(input);
  if (input.editMode === "next") {
    const today = DateTime.now().setZone(settings().timezone).toISODate()!,
      next = events(
        old,
        DateTime.fromISO(today).plus({ days: 1 }).toISODate()!,
        DateTime.fromISO(today).plus({ years: 100 }).toISODate()!,
        2,
      ).find((e) => e.type === "renewal");
    if (!next || old.kind !== "recurring" || s.kind !== "recurring")
      throw new Error("无可变更的下次续费");
    s = {
      ...s,
      start: old.start,
      rules: [
        ...old.rules.filter((r: any) => r.effective < next.date),
        { ...s.rules[0], effective: next.date },
      ],
    };
  }
  saveSub({ ...s, id });
  db.prepare("DELETE FROM jobs WHERE id LIKE ? AND status!='sent'").run(
    id + ":%",
  );
  return { ...s, id };
});
app.delete("/api/v1/subscriptions/:id", (req) => {
  const id = (req.params as any).id;
  transaction(() => {
    db.prepare("DELETE FROM subscriptions WHERE id=?").run(id);
    db.prepare("DELETE FROM jobs WHERE id LIKE ?").run(id + ":%");
  });
  return { ok: true };
});
app.get("/api/v1/categories", () => {
  const usage = new Map<string, number>();
  for (const s of allSubs())
    usage.set(s.category, (usage.get(s.category) || 0) + 1);
  return db
    .prepare("SELECT * FROM categories")
    .all()
    .map((c) => ({
      ...c,
      usageCount: usage.get(c.name as string) || 0,
    }));
});
app.post("/api/v1/categories", (req) => {
  const b = z
    .object({
      name: z.string().trim().min(1).max(40),
      color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    })
    .parse(req.body);
  db.prepare(
    "INSERT INTO categories VALUES(?,?) ON CONFLICT(name) DO UPDATE SET color=excluded.color",
  ).run(b.name, b.color);
  return b;
});
app.delete("/api/v1/categories/:name", (req) => {
  const name = (req.params as any).name;
  if (name === "未分类") throw new Error("不能删除默认分类");
  transaction(() => {
    if (allSubs().some((s) => s.category === name))
      throw Object.assign(new Error("该分类已有订阅项目使用，不能删除"), {
        statusCode: 409,
      });
    db.prepare("DELETE FROM categories WHERE name=?").run(name);
  });
  return { ok: true };
});
app.post("/api/v1/logos", async (req) => {
  const file = await req.file();
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)
  )
    throw new Error("请选择 PNG、JPEG 或 WebP");
  const bytes = await file.toBuffer();
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Logo 最大 5 MB");
  const image = sharp(bytes, { limitInputPixels: 25000000 });
  const meta = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format || ""))
    throw new Error("图片格式无效");
  const id = randomUUID() + ".webp";
  await image
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .webp()
    .toFile(resolve(dataDir, "logos", id));
  return { logo: id };
});
app.get("/api/v1/logos/:name", (req, reply) => {
  const name = (req.params as any).name;
  if (
    !/^[a-f0-9-]+\.webp$/.test(name) ||
    !existsSync(resolve(dataDir, "logos", name))
  )
    return reply.code(404).send();
  return reply
    .type("image/webp")
    .send(readFileSync(resolve(dataDir, "logos", name)));
});
app.get("/api/v1/events", (req) => {
  const q = z
    .object({
      from: z.iso.date(),
      to: z.iso.date(),
      category: z.string().optional(),
      kind: z.string().optional(),
      currency: z.string().optional(),
    })
    .parse(req.query);
  if (
    q.to < q.from ||
    DateTime.fromISO(q.to).diff(DateTime.fromISO(q.from), "years").years > 20
  )
    throw new Error("查询区间应在 20 年内");
  const s = settings(),
    cache = get("rates", {}),
    rates = cache.base === s.base ? cache.rates || {} : {};
  const result = allSubs()
    .filter(
      (sub) =>
        (!q.category || sub.category === q.category) &&
        (!q.kind || sub.kind === q.kind),
    )
    .flatMap((sub) => events(sub, q.from, q.to))
    .filter((e) => !q.currency || e.currency === q.currency)
    .map((e) => convert(e, s.base, rates));
  return {
    events: result,
    base: s.base,
    rateDate: cache.base === s.base ? cache.date : null,
    missing: [
      ...new Set(
        result
          .filter((e) => e.converted === null && e.amount > 0)
          .map((e) => e.currency),
      ),
    ],
  };
});
app.get("/api/v1/settings", () => ({
  ...settings(),
  hasBarkKey: !!get("barkKey", ""),
  rates: get("rates", {}),
  ratesStatus: get("ratesStatus", {}),
  ratesNextRefresh: nextRateRefresh(settings()),
}));
app.put("/api/v1/settings", (req) => {
  const b = z
    .object({
      base: z.string().regex(/^[A-Z]{3}$/),
      timezone: z.string().refine((v) => DateTime.now().setZone(v).isValid),
      reminders: z.array(z.number().int().min(0).max(365)).max(10),
      barkServer: z.url().refine((v) => /^https?:/.test(v)),
      barkGroup: z.string().max(100),
      appUrl: z.union([
        z.literal(""),
        z.url().refine((v) => /^https?:/.test(v)),
      ]),
      ratesAutoRefresh: z.boolean().default(true),
      ratesRefreshFrequency: z.enum(["daily", "weekly"]).default("daily"),
      ratesRefreshTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default("09:00"),
      ratesRefreshWeekday: z.number().int().min(1).max(7).default(1),
      barkEnabled: z.boolean(),
      barkKey: z.string().optional(),
    })
    .parse(req.body);
  const { barkKey, ...rest } = b;
  if (barkKey) set("barkKey", encrypt(barkKey));
  set("settings", rest);
  return { ok: true };
});
app.post("/api/v1/rates/refresh", ratesRefresh);
app.get("/api/v1/bark/icons/:name", async (req, reply) => {
  const name = (req.params as { name: string }).name;
  if (
    !verifyIconSignature(name, (req.query as { signature?: string }).signature)
  )
    return reply.code(404).send();
  const path =
    name === appIconName
      ? resolve(
          existsSync("dist/icons/icon-192.png") ? "dist" : "public",
          "icons/icon-192.png",
        )
      : resolve(dataDir, "logos", name);
  if (!existsSync(path)) return reply.code(404).send();
  // PNG is supported by the iOS notification extension, including uploaded WebP logos.
  return reply
    .type("image/png")
    .send(await sharp(path).resize(192, 192).png().toBuffer());
});
app.post("/api/v1/bark/test", async (req) => {
  await bark(
    "连接成功，你的订阅到期提醒将在这里出现。",
    "订阅集 · 测试通知",
    undefined,
    req.headers.origin || `${req.protocol}://${req.host}`,
  );
  return { ok: true };
});
app.get("/api/v1/notifications", () =>
  db.prepare("SELECT * FROM jobs ORDER BY next DESC LIMIT 100").all(),
);
app.post("/api/v1/notifications/:id/retry", (req) => {
  const row = db
    .prepare("SELECT * FROM jobs WHERE id=?")
    .get((req.params as any).id) as any;
  if (!row) throw new Error("任务不存在");
  const data = JSON.parse(row.data);
  data.notificationDate = DateTime.now()
    .setZone(settings().timezone)
    .toISODate();
  db.prepare(
    "UPDATE jobs SET status='retry',attempt=0,next=?,data=? WHERE id=?",
  ).run(Date.now(), JSON.stringify(data), row.id);
  return { ok: true };
});
app.get("/api/v1/export", async (req, reply) => {
  const format = (req.query as any).format;
  if (format === "csv") {
    const data = allSubs().map((s) => ({
      ...s,
      ...s.rules.at(-1),
      amount: major(s.rules.at(-1).amount, s.rules.at(-1).currency),
      rules: undefined,
      reminders: undefined,
    }));
    return reply
      .header("Content-Disposition", "attachment; filename=subscriptions.csv")
      .type("text/csv; charset=utf-8")
      .send("\uFEFF" + Papa.unparse(data, { escapeFormulae: true }));
  }
  return reply
    .header("Content-Disposition", "attachment; filename=subscriptions.json")
    .send({
      version: 1,
      subscriptions: allSubs(),
      categories: db.prepare("SELECT * FROM categories").all(),
    });
});
function importData(body: any) {
  let rows: any[];
  let categories: any[] = [];
  if (body.format === "csv") {
    const parsed = Papa.parse(body.text, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length) throw new Error("CSV 解析失败");
    rows = (parsed.data as any[]).map((r) => ({
      ...r,
      kind: r.kind || "recurring",
      autoRenew: r.autoRenew !== "false",
      archived: r.archived === "true",
      end: r.end || null,
      logo: null,
      reminders: null,
      rules: [
        {
          effective: r.start,
          amount: (() => {
            try {
              return minor(r.amount, r.currency || "CNY");
            } catch {
              return NaN;
            }
          })(),
          currency: r.currency || "CNY",
          unit: r.unit || "months",
          interval: Number(r.interval || 1),
        },
      ],
    }));
  } else {
    const json = JSON.parse(body.text);
    if (json.version !== 1 || !Array.isArray(json.subscriptions))
      throw new Error("无效的 JSON 版本");
    rows = json.subscriptions;
    categories = z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
        }),
      )
      .parse(json.categories || []);
  }
  if (rows.length > 10000) throw new Error("单次最多导入 10000 条");
  const errors: any[] = [],
    valid: Subscription[] = [];
  rows.forEach((r, i) => {
    const parsed = subscriptionSchema.safeParse({ ...r, logo: null });
    if (parsed.success) valid.push({ ...parsed.data, id: randomUUID() });
    else
      errors.push({
        row: i + 1,
        error: parsed.error.issues.map((e) => e.message).join("；"),
      });
  });
  return { valid, errors, categories };
}
app.post("/api/v1/import/preview", (req) => {
  const { valid, errors } = importData(req.body);
  return { count: valid.length, errors, preview: valid.slice(0, 10) };
});
app.post("/api/v1/import", (req) => {
  const { valid, errors, categories } = importData(req.body);
  if (errors.length) throw new Error("请先修复全部导入错误");
  transaction(() => {
    for (const c of categories)
      db.prepare("INSERT OR IGNORE INTO categories VALUES(?,?)").run(
        c.name,
        c.color,
      );
    for (const s of valid) {
      db.prepare("INSERT OR IGNORE INTO categories VALUES(?,?)").run(
        s.category,
        "#64748b",
      );
      saveSub(s);
    }
  });
  return { count: valid.length };
});
app.get("/api/v1/backups", () =>
  readdirSync(resolve(dataDir, "backups"))
    .filter((f) => f.endsWith(".zip"))
    .sort()
    .reverse(),
);
app.post("/api/v1/backups", async () => ({ name: await createBackup() }));
app.get("/api/v1/backups/:name", (req, reply) => {
  const name = (req.params as any).name;
  if (!/^[a-z0-9-]+\.zip$/.test(name)) throw new Error("无效文件名");
  return reply
    .type("application/zip")
    .header("Content-Disposition", `attachment; filename=${name}`)
    .send(readFileSync(resolve(dataDir, "backups", name)));
});
app.post("/api/v1/restore", async (req) => {
  const f = await req.file();
  if (!f) throw new Error("请选择备份");
  await restoreBackup(await f.toBuffer());
  return { ok: true };
});
// Only the public CA certificate is served here; private keys remain in Caddy's volume.
app.get("/lan-ca.crt", (_req, reply) => {
  const path = resolve(dataDir, "lan-ca.crt");
  if (!existsSync(path))
    return reply.code(404).send({ error: "尚未导出局域网 CA 证书" });
  return reply
    .header("Cache-Control", "no-store")
    .header(
      "Content-Disposition",
      'attachment; filename="Subscriptions-LAN-CA.crt"',
    )
    .type("application/x-x509-ca-cert")
    .send(readFileSync(path));
});
const dist = resolve("dist");
if (existsSync(dist)) {
  await app.register(staticPlugin, { root: dist });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "接口不存在" })
      : reply.sendFile("index.html"),
  );
}
if (process.env.NODE_ENV !== "test") {
  await app.listen({ port: Number(process.env.PORT || 3000), host: "0.0.0.0" });
  setTimeout(() => tick().catch((e) => app.log.error(e)), 3000).unref();
  setInterval(() => tick().catch((e) => app.log.error(e)), 60000).unref();
}
