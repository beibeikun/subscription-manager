import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
const dir = mkdtempSync(join(tmpdir(), "subscription-services-"));
let store: any, svc: any;
beforeAll(async () => {
  process.env.DATA_DIR = dir;
  process.env.ENCRYPTION_KEY = "b".repeat(64);
  process.env.INIT_ADMIN_PASSWORD = "service-test-password";
  store = await import("../server/db.js");
  svc = await import("../server/services.js");
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
  store.db.exec("DELETE FROM subscriptions; DELETE FROM jobs");
  store.set("settings", { ...store.defaults, barkEnabled: true });
  store.set("barkKey", store.encrypt("test-key"));
  store.set("lastBackup", "2026-09-27");
  store.set("rates", {
    base: "CNY",
    rates: { USD: 7 },
    date: "2026-09-26",
    updated: Date.now(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
afterAll(() => {
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});
const sample = () => ({
  id: "test-id",
  name: "提醒会员",
  kind: "recurring",
  start: "2026-08-28",
  autoRenew: true,
  category: "未分类",
  notes: "",
  website: "",
  archived: false,
  reminders: [1],
  rules: [
    {
      effective: "2026-08-28",
      amount: 2000,
      currency: "CNY",
      unit: "months",
      interval: 1,
    },
  ],
});
describe("background integrations and recovery", () => {
  it("fetches base-currency rates and inverts each quote for spend conversion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { base: "CNY", quote: "USD", rate: 0.125, date: "2026-09-27" },
            { base: "CNY", quote: "EUR", rate: 0.1, date: "2026-09-27" },
          ]),
        ),
      ),
    );
    const cache = await svc.ratesRefresh();
    expect(cache.rates.USD).toBe(8);
    expect(cache.rates.EUR).toBe(10);
  });

  it("sends once per event and lead time across ticks", async () => {
    store.set("settings", {
      ...store.settings(),
      barkServer: "https://api.day.app/test-key/",
      appUrl: "https://subscriptions.example.com/",
    });
    store.set("barkKey", store.encrypt("test-key/"));
    store.saveSub({ ...sample(), logo: "abcd-1234.webp" });
    writeFileSync(join(dir, "logos", "abcd-1234.webp"), "fixture-logo");
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 200 })));
    vi.stubGlobal("fetch", fetch);
    await svc.tick();
    await svc.tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("https://api.day.app/push");
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.device_key).toBe("test-key");
    expect(payload.title).toBe("提醒会员 · 还有 1 天续费");
    expect(payload.body).toContain("预计扣款：¥20.00（CNY）");
    expect(new URL(payload.icon).pathname).toBe(
      "/api/v1/bark/icons/abcd-1234.webp",
    );
    expect(new URL(payload.icon).searchParams.get("signature")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(store.db.prepare("SELECT status FROM jobs").get().status).toBe(
      "sent",
    );
  });
  it("uses the app icon for test notifications and missing project logos", async () => {
    store.set("settings", {
      ...store.settings(),
      appUrl: "https://subscriptions.example.com",
    });
    store.saveSub({ ...sample(), logo: "dead-beef.webp" });
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ code: 200 }))),
      );
    vi.stubGlobal("fetch", fetch);
    await svc.bark("测试", "订阅集 · 测试通知");
    await svc.bark("提醒", "订阅提醒", "test-id");
    for (const call of fetch.mock.calls)
      expect(new URL(JSON.parse(call[1].body).icon).pathname).toBe(
        "/api/v1/bark/icons/app.png",
      );
  });
  it("retries 1/5/30 minutes then records failure", async () => {
    store.saveSub(sample());
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response("{}", { status: 503 })),
        ),
    );
    await svc.tick();
    for (const minutes of [1, 5, 30]) {
      vi.setSystemTime(new Date(Date.now() + minutes * 60000));
      await svc.tick();
    }
    const job = store.db.prepare("SELECT * FROM jobs").get();
    expect(job.attempt).toBe(4);
    expect(job.status).toBe("failed");
  });
  it("marks old jobs expired instead of catch-up flooding", async () => {
    store.db
      .prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?)")
      .run(
        "old",
        JSON.stringify({ notificationDate: "2026-09-26" }),
        "pending",
        0,
        0,
        null,
      );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await svc.tick();
    expect(fetch).not.toHaveBeenCalled();
    expect(store.db.prepare("SELECT status FROM jobs").get().status).toBe(
      "expired",
    );
  });
  it("keeps cached rates when offline", async () => {
    store.set("rates", {
      base: "CNY",
      rates: { USD: 7 },
      date: "2026-09-25",
      updated: 0,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await svc.tick();
    expect(store.get("rates", {}).rates.USD).toBe(7);
  });
  it("marks ambiguous Bark timeout", async () => {
    store.saveSub(sample());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    );
    await svc.tick();
    expect(store.db.prepare("SELECT error FROM jobs").get().error).toContain(
      "可能已送达",
    );
  });
  it("restores subscriptions, logo, rules and revokes sessions", async () => {
    const s = { ...sample(), logo: "1234-abcd.webp" };
    store.saveSub(s);
    writeFileSync(join(dir, "logos", s.logo), Buffer.from("fixture-logo"));
    const file = await svc.createBackup();
    const buffer = readFileSync(join(dir, "backups", file));
    store.db.exec("DELETE FROM subscriptions");
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run("token", "csrf", Date.now() + 10000);
    await svc.restoreBackup(buffer);
    expect(store.allSubs()).toEqual([s]);
    expect(existsSync(join(dir, "logos", s.logo))).toBe(true);
    expect(store.db.prepare("SELECT count(*) n FROM sessions").get().n).toBe(0);
  });
  it("rejects unsafe archive names before changing live data", async () => {
    store.saveSub(sample());
    const zip = new AdmZip();
    zip.addFile("unexpected.txt", Buffer.from("invalid"));
    await expect(svc.restoreBackup(zip.toBuffer())).rejects.toThrow(
      "备份内容不合法",
    );
    expect(store.allSubs()).toHaveLength(1);
  });
  it("does not initialize an existing admin again", () => {
    expect(
      store.verify("service-test-password", store.get("admin", {}).hash),
    ).toBe(true);
  });
});
