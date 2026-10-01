import sharp from "sharp";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const image = process.argv[2] || "subscription-manager:1.0.0";
const arch = process.argv[3] || "linux/arm64";
const name = "subscriptions-smoke-" + Date.now(),
  volume = name + "-data";
const password = randomBytes(18).toString("hex");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let base, cookie, csrf;
async function call(path, method = "GET", payload) {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...(payload && !(payload instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
    },
    body: payload
      ? payload instanceof FormData
        ? payload
        : JSON.stringify(payload)
      : undefined,
  });
  return r;
}
try {
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--platform",
    arch,
    "--cpus",
    "2",
    "--memory",
    "2g",
    "-p",
    "127.0.0.1::3000",
    "-v",
    volume + ":/data",
    "-e",
    "INIT_ADMIN_PASSWORD=" + password,
    "-e",
    "ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
    image,
  );
  const port = docker("port", name, "3000/tcp").split(":").at(-1);
  base = "http://127.0.0.1:" + port;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await call("/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const login = await call("/auth/login", "POST", {
    username: "admin",
    password,
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie").split(";")[0];
  csrf = (await login.json()).csrf;
  const s = {
    name: "Container smoke",
    kind: "recurring",
    start: "2026-01-31",
    autoRenew: true,
    category: "未分类",
    rules: [
      {
        effective: "2026-01-31",
        amount: 1000,
        currency: "CNY",
        unit: "months",
        interval: 1,
      },
    ],
  };
  const created = await call("/subscriptions", "POST", s);
  assert.equal(created.status, 200);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob(
      [
        await sharp({
          create: { width: 32, height: 32, channels: 4, background: "#28796c" },
        })
          .png()
          .toBuffer(),
      ],
      { type: "image/png" },
    ),
    "pixel.png",
  );
  const logo = await call("/logos", "POST", fd);
  assert.equal(logo.status, 200, await logo.clone().text());
  const backup = await call("/backups", "POST");
  assert.equal(backup.status, 200);
  const zip = await call("/backups/" + (await backup.json()).name);
  assert.equal(zip.status, 200);
  assert.equal(
    Buffer.from(await zip.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    "PK",
  );
  docker("restart", name);
  base =
    "http://127.0.0.1:" + docker("port", name, "3000/tcp").split(":").at(-1);
  for (let i = 0; i < 100; i++) {
    try {
      if ((await call("/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal((await (await call("/subscriptions")).json()).length, 1);
  const imported = await call("/import", "POST", {
    format: "json",
    text: JSON.stringify({
      version: 1,
      subscriptions: Array.from({ length: 999 }, (_, i) => ({
        ...s,
        name: "Performance " + i,
      })),
    }),
  });
  assert.equal(imported.status, 200);
  const start = performance.now();
  const stats = await call("/events?from=2026-01-01&to=2026-12-31");
  const data = await stats.json();
  assert.equal(data.events.length, 12000);
  const elapsed = Math.round(performance.now() - start);
  console.log(
    JSON.stringify({
      image,
      arch,
      login: true,
      logo: true,
      backup: true,
      restartPersistence: true,
      subscriptions: 1000,
      annualEvents: 12000,
      annualRequestMs: elapsed,
      performanceTargetMet: elapsed < 1000,
    }),
  );
} catch (error) {
  console.error(docker("logs", name));
  throw error;
} finally {
  try {
    docker("rm", "-f", name);
  } catch {}
  try {
    docker("volume", "rm", volume);
  } catch {}
}
