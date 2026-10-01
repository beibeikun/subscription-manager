import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("PWA manifest, installability and safe offline fallback", async ({
  page,
  context,
  request,
  browserName,
}) => {
  await page.goto("/");
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.id).toBe("/");
  expect(manifest.icons.map((i: any) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    const metadata = await sharp(await image.body()).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
  }
  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.headers()["cache-control"]).toBe("no-store");
  expect(await workerResponse.text()).not.toContain("__CACHE_VERSION__");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  if (browserName === "chromium") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    const result = await cdp.send("Page.getInstallabilityErrors");
    expect(result.installabilityErrors).toEqual([]);
  }
  await page.evaluate(() => fetch("/api/v1/auth/me"));
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const key of await (await caches.open(name)).keys())
        urls.push(key.url);
    }
    return urls;
  });
  expect(cached.some((u) => new URL(u).pathname.startsWith("/api/"))).toBe(
    false,
  );
  await context.setOffline(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "暂时无法连接订阅集" }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "重新连接" }).click();
  await expect(
    page.getByRole("heading", { name: "欢迎回到订阅集" }),
  ).toBeVisible();
});
