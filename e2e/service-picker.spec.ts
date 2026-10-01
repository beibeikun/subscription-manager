import { test, expect } from "@playwright/test";

test("search service, save builtin logo, edit directly, and start a blank custom subscription", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await page
    .getByRole("button", { name: "添加订阅", exact: true })
    .first()
    .click();
  const picker = page.getByRole("dialog", { name: "选择订阅服务" });
  await expect(picker).toBeVisible();
  expect(
    (await picker.locator(".service-search").boundingBox())!.height,
  ).toBeLessThan(60);
  await expect(page.getByLabel("搜索订阅服务")).toBeFocused();
  await page.getByLabel("搜索订阅服务").fill("网飞");
  await expect(picker.locator(".service-option")).toHaveCount(1);
  await expect(picker.getByRole("button", { name: "Netflix" })).toBeVisible();
  await page.getByLabel("搜索订阅服务").fill("chatgpt.com");
  await expect(picker.locator(".service-option")).toHaveCount(1);
  await picker.getByRole("button", { name: "ChatGPT" }).click();
  await expect(page.getByLabel("订阅名称")).toHaveValue("ChatGPT");
  await expect(page.getByLabel("官网链接")).toHaveValue("https://chatgpt.com");
  const preview = page.locator(".logo-upload img");
  await expect(preview).toHaveAttribute("src", "/service-icons/chatgpt.webp");
  await expect
    .poll(() =>
      preview.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "重新选择服务" }).click();
  await expect(picker).toBeVisible();
  await page.getByLabel("搜索订阅服务").fill("Spotify");
  await page.screenshot({
    path: `work/${info.project.name}-service-picker.png`,
    fullPage: true,
  });
  await picker.getByRole("button", { name: "Spotify" }).click();
  await page.getByLabel("订阅名称").fill(`Spotify ${info.project.name}`);
  await page.getByLabel("每期金额").fill("25");
  await page.getByRole("button", { name: "保存订阅" }).click();
  const card = page.locator(".sub-card").filter({
    has: page.getByRole("heading", {
      name: `Spotify ${info.project.name}`,
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  await expect(card.locator("img.logo")).toHaveAttribute(
    "src",
    /\/api\/v1\/logos\/[a-f0-9-]+\.webp/,
  );
  const subscriptions = await (
    await page.request.get("/api/v1/subscriptions")
  ).json();
  const saved = subscriptions.find(
    (s: any) => s.name === `Spotify ${info.project.name}`,
  );
  expect(saved.logo).toMatch(/^[a-f0-9-]+\.webp$/);
  expect((await page.request.get(`/api/v1/logos/${saved.logo}`)).ok()).toBe(
    true,
  );
  await card.hover();
  await card.getByTitle("编辑", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "编辑订阅", exact: true }),
  ).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(page.locator(".logo-upload img")).toHaveAttribute(
    "src",
    `/api/v1/logos/${saved.logo}`,
  );
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .getByRole("button", { name: "添加订阅", exact: true })
    .first()
    .click();
  await page.getByLabel("搜索订阅服务").fill("找不到的服务xyz");
  await expect(
    page.getByText("没有找到对应服务", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "自定义订阅" }).click();
  await expect(page.getByLabel("订阅名称")).toHaveValue("");
  await expect(page.getByLabel("官网链接")).toHaveValue("");
  await expect(page.locator(".logo-upload img")).toHaveCount(0);
  await page.getByRole("button", { name: "取消", exact: true }).click();
});

test("builtin logo can be removed before saving", async ({ page }, info) => {
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await page
    .getByRole("button", { name: "添加订阅", exact: true })
    .first()
    .click();
  await page.getByLabel("搜索订阅服务").fill("Netflix");
  await page.getByRole("button", { name: "Netflix" }).click();
  await page.getByRole("button", { name: "移除", exact: true }).click();
  await expect(page.locator(".logo-upload img")).toHaveCount(0);
  await page.getByLabel("订阅名称").fill(`No logo ${info.project.name}`);
  await page.getByRole("button", { name: "保存订阅" }).click();
  await expect(
    page.getByRole("heading", { name: `No logo ${info.project.name}` }),
  ).toBeVisible();
  const subscriptions = await (
    await page.request.get("/api/v1/subscriptions")
  ).json();
  expect(
    subscriptions.find((s: any) => s.name === `No logo ${info.project.name}`)
      .logo,
  ).toBeNull();
});
