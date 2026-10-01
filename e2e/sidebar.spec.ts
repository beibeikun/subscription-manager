import { test, expect } from "@playwright/test";

test("sidebar collapse preserves navigation, preference and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的订阅" })).toBeVisible();
  const collapse = page.getByRole("button", {
    name: "收起侧边菜单",
    exact: true,
  });
  if (info.project.name === "mobile") {
    await expect(collapse).toBeHidden();
    await expect(page.locator(".nav-text").first()).toBeVisible();
    return;
  }
  const expanded = await page.locator(".workspace").boundingBox();
  await collapse.click();
  const expand = page.getByRole("button", {
    name: "展开侧边菜单",
    exact: true,
  });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".nav-text").first()).toBeHidden();
  await expect
    .poll(async () => (await page.locator(".workspace").boundingBox())!.x)
    .toBe(76);
  expect(
    (await page.locator(".workspace").boundingBox())!.width,
  ).toBeGreaterThan(expanded!.width);
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bark 推送" })).toBeVisible();
  await page.reload();
  await expect(expand).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(expand).toBeHidden();
  await expect(page.locator(".nav-text").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(expand).toBeVisible();
  await page.screenshot({ path: "work/sidebar-collapsed.png", fullPage: true });
  await expand.click();
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".nav-text").first()).toBeVisible();
  await expect
    .poll(async () => (await page.locator(".workspace").boundingBox())!.x)
    .toBe(190);
  await page.reload();
  await expect(collapse).toBeVisible();
});
