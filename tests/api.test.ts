import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { barkIconUrl } from "../server/bark-icons.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
let app: any, cookie: string, csrf: string;
const dir = mkdtempSync(join(tmpdir(), "subscriptions-test-"));
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATA_DIR = dir;
  process.env.INIT_ADMIN_PASSWORD = "test-password-12345";
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  app = (await import("../server/index.js")).app;
  await app.ready();
  const r = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "admin", password: "test-password-12345" },
  });
  cookie = r.headers["set-cookie"].split(";")[0];
  csrf = r.json().csrf;
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});
const call = (method: string, url: string, payload?: any) =>
  app.inject({
    method,
    url: "/api/v1" + url,
    headers: { cookie, "x-csrf-token": csrf },
    payload,
  });
const sample = {
  name: "API 会员",
  kind: "recurring",
  start: "2026-01-31",
  autoRenew: true,
  category: "未分类",
  notes: "",
  website: "",
  rules: [
    {
      effective: "2026-01-31",
      amount: 2000,
      currency: "CNY",
      unit: "months",
      interval: 1,
    },
  ],
};
describe("API and security", () => {
  it("serves only signed notification icons without a login, as PNG", async () => {
    const logo = "abcd-5678.webp";
    writeFileSync(
      join(dir, "logos", logo),
      await sharp({
        create: { width: 256, height: 256, channels: 4, background: "red" },
      })
        .webp()
        .toBuffer(),
    );
    for (const name of [null, logo]) {
      const url = new URL(
        barkIconUrl("https://subscriptions.example.com", name)!,
      );
      const response = await app.inject({
        method: "GET",
        url: url.pathname + url.search,
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect((await sharp(response.rawPayload).metadata()).format).toBe("png");
      expect(
        (await app.inject({ method: "GET", url: url.pathname })).statusCode,
      ).toBe(404);
      url.searchParams.set("signature", "0".repeat(64));
      expect(
        (await app.inject({ method: "GET", url: url.pathname + url.search }))
          .statusCode,
      ).toBe(404);
    }
    expect(
      (await app.inject({ method: "GET", url: `/api/v1/logos/${logo}` }))
        .statusCode,
    ).toBe(401);
    const signed = new URL(
      barkIconUrl("https://subscriptions.example.com", logo)!,
    );
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/bark/icons/dead-beef.webp" + signed.search,
        })
      ).statusCode,
    ).toBe(404);
  });
  it("includes the subscription manager logo in the settings test notification", async () => {
    const store = await import("../server/db.js");
    store.set("barkKey", store.encrypt("test-device-key"));
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ code: 200 }))),
      );
    vi.stubGlobal("fetch", fetch);
    try {
      expect((await call("POST", "/bark/test")).statusCode).toBe(200);
      const icon = new URL(JSON.parse(fetch.mock.calls[0][1].body).icon);
      expect(icon.pathname).toBe("/api/v1/bark/icons/app.png");
      expect(
        (await app.inject({ method: "GET", url: icon.pathname + icon.search }))
          .statusCode,
      ).toBe(200);
      const proxied = await app.inject({
        method: "POST",
        url: "/api/v1/bark/test",
        headers: {
          cookie,
          "x-csrf-token": csrf,
          host: "192.168.31.153:3443",
          origin: "https://192.168.31.153:3443",
        },
      });
      expect(proxied.statusCode).toBe(200);
      expect(new URL(JSON.parse(fetch.mock.calls[1][1].body).icon).origin).toBe(
        "https://192.168.31.153:3443",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("updates profile safely and uses the new username at login", async () => {
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/v1/auth/profile",
          payload: { username: "new-admin", avatar: "" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/v1/auth/profile",
          headers: { cookie },
          payload: { username: "new-admin", avatar: "" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call("PUT", "/auth/profile", { username: " ", avatar: "" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call("PUT", "/auth/profile", {
          username: "new-admin",
          avatar: "../secret.webp",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call("PUT", "/auth/profile", {
          username: "new-admin",
          avatar: "",
        })
      ).statusCode,
    ).toBe(200);
    const me = (await call("GET", "/auth/me")).json();
    expect(me.username).toBe("new-admin");
    expect(me).not.toHaveProperty("hash");
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "new-admin", password: "test-password-12345" },
    });
    expect(login.statusCode).toBe(200);
    expect(
      (await call("PUT", "/auth/profile", { username: "admin", avatar: "" }))
        .statusCode,
    ).toBe(200);
  });

  it("requires login and CSRF", async () => {
    expect(
      (await app.inject({ url: "/api/v1/subscriptions" })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/subscriptions",
          headers: { cookie },
          payload: sample,
        })
      ).statusCode,
    ).toBe(403);
  });
  it("rejects foreign origin", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/subscriptions",
      headers: { cookie, "x-csrf-token": csrf, origin: "https://evil.example" },
      payload: sample,
    });
    expect(r.statusCode).toBe(403);
  });
  it("creates subscriptions and aggregates events", async () => {
    const r = await call("POST", "/subscriptions", sample);
    expect(r.statusCode).toBe(200);
    const list = (await call("GET", "/subscriptions")).json();
    expect(list.length).toBe(1);
    const es = (
      await call("GET", "/events?from=2026-01-01&to=2026-03-31")
    ).json();
    expect(es.events.map((e: any) => e.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(es.events.reduce((n: number, e: any) => n + e.converted, 0)).toBe(
      60,
    );
  });
  it("protects categories used by active and archived subscriptions", async () => {
    const name = "受保护分类";
    const path = "/categories/" + encodeURIComponent(name);
    expect(
      (await call("POST", "/categories", { name, color: "#28796c" }))
        .statusCode,
    ).toBe(200);
    const created = (
      await call("POST", "/subscriptions", { ...sample, category: name })
    ).json();
    for (const archived of [false, true]) {
      if (archived)
        await call("PUT", "/subscriptions/" + created.id, {
          ...created,
          archived: true,
        });
      const before = (await call("GET", "/subscriptions")).json();
      const rejected = await call("DELETE", path);
      expect(rejected.statusCode).toBe(409);
      expect(rejected.json().error).toContain("不能删除");
      expect((await call("GET", "/subscriptions")).json()).toEqual(before);
      expect(
        (await call("GET", "/categories"))
          .json()
          .find((c: any) => c.name === name).usageCount,
      ).toBe(1);
    }
    await call("DELETE", "/subscriptions/" + created.id);
    expect(
      (await call("GET", "/categories"))
        .json()
        .find((c: any) => c.name === name).usageCount,
    ).toBe(0);
    expect((await call("DELETE", path)).statusCode).toBe(200);
    expect(
      (await call("GET", "/categories"))
        .json()
        .some((c: any) => c.name === name),
    ).toBe(false);
    expect(
      (await call("DELETE", "/categories/" + encodeURIComponent("未分类")))
        .statusCode,
    ).toBe(400);
  });
  it("validates import before mutation", async () => {
    const text = JSON.stringify({
      version: 1,
      subscriptions: [sample, { ...sample, name: "" }],
    });
    const preview = await call("POST", "/import/preview", {
      format: "json",
      text,
    });
    expect(preview.json().errors).toHaveLength(1);
    expect(
      (await call("POST", "/import", { format: "json", text })).statusCode,
    ).toBe(400);
    expect((await call("GET", "/subscriptions")).json()).toHaveLength(1);
  });
  it("does not expose Bark secrets", async () => {
    await call("PUT", "/settings", {
      base: "CNY",
      timezone: "Asia/Shanghai",
      reminders: [7, 1, 0],
      barkServer: "https://api.day.app",
      barkGroup: "test",
      appUrl: "",
      barkEnabled: false,
      barkKey: "secret-device-key",
    });
    const r = await call("GET", "/settings");
    expect(r.body).not.toContain("secret-device-key");
    expect(r.json().hasBarkKey).toBe(true);
  });
  it("exports schema version without credentials", async () => {
    const r = await call("GET", "/export");
    expect(r.json().version).toBe(1);
    expect(r.body).not.toContain("hash");
    expect(r.body).not.toContain("barkKey");
  });
  it("creates a downloadable consistent backup", async () => {
    const r = await call("POST", "/backups");
    expect(r.statusCode).toBe(200);
    const download = await call("GET", "/backups/" + r.json().name);
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload.subarray(0, 2).toString()).toBe("PK");
  });
  it("rejects nine characters and accepts a ten-character new password", async () => {
    expect(
      (
        await call("POST", "/auth/password", {
          old: "test-password-12345",
          password: "123456789",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call("POST", "/auth/password", {
          old: "test-password-12345",
          password: "abcdefghij",
        })
      ).statusCode,
    ).toBe(200);
    expect((await call("GET", "/auth/me")).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "abcdefghij" },
    });
    expect(login.statusCode).toBe(200);
  });
});
