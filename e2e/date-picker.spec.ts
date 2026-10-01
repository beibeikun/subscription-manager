import { test, expect } from "@playwright/test";

test("custom dates support leap days, keyboard navigation and persist both fields", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await page
    .getByRole("button", { name: "添加订阅", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "自定义订阅" }).click();
  const start = page.getByRole("textbox", {
    name: "开始 / 购买日期",
    exact: true,
  });
  await start.fill("2024-01-31");
  await page
    .getByRole("button", { name: "选择开始 / 购买日期", exact: true })
    .click();
  const calendar = page.getByRole("dialog", {
    name: "开始 / 购买日期日历",
    exact: true,
  });
  await expect(calendar).toBeVisible();
  await expect(
    calendar.getByRole("button", { name: "2024-01-31", exact: true }),
  ).toBeFocused();
  await calendar.getByRole("button", { name: "下个月", exact: true }).click();
  await expect(
    calendar.getByRole("button", { name: "2024-02-29", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `work/${info.project.name}-date-picker.png`,
    fullPage: true,
  });
  const box = (await calendar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await calendar
    .getByRole("button", { name: "2024-02-29", exact: true })
    .click();
  await expect(start).toHaveValue("2024-02-29");
  await expect(calendar).toHaveCount(0);
  await start.press("ArrowDown");
  await calendar
    .getByRole("button", { name: "2024-02-29", exact: true })
    .press("ArrowRight");
  await expect(
    calendar.getByRole("button", { name: "2024-03-01", exact: true }),
  ).toBeFocused();
  await calendar
    .getByRole("button", { name: "2024-03-01", exact: true })
    .press("Enter");
  await expect(start).toHaveValue("2024-03-01");
  await start.press("ArrowDown");
  await calendar.getByRole("button", { name: "选择年份", exact: true }).click();
  await calendar
    .getByRole("button", { name: "下一组年份", exact: true })
    .click();
  await calendar.getByRole("button", { name: "2028年", exact: true }).click();
  await calendar.getByRole("button", { name: "2月", exact: true }).click();
  await calendar
    .getByRole("button", { name: "2028-02-29", exact: true })
    .click();
  await expect(start).toHaveValue("2028-02-29");
  await start.press("ArrowDown");
  await calendar
    .getByRole("button", { name: "2028-02-29", exact: true })
    .press("Escape");
  await expect(calendar).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "添加新的订阅" }),
  ).toBeVisible();
  await start.fill("2026-02-30");
  expect(
    await start.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await start.press("ArrowDown");
  const today = await calendar
    .locator('[aria-current="date"]')
    .getAttribute("aria-label");
  await calendar.getByRole("button", { name: "今天", exact: true }).click();
  await expect(start).toHaveValue(today!);
  await page.getByLabel("自动续费").uncheck();
  const end = page.getByRole("textbox", {
    name: "当前服务到期日",
    exact: true,
  });
  await expect(end).toHaveValue("");
  await end.fill("2028-03-01");
  await page
    .getByRole("button", { name: "选择当前服务到期日", exact: true })
    .click();
  const endCalendar = page.getByRole("dialog", {
    name: "当前服务到期日日历",
    exact: true,
  });
  await endCalendar
    .getByRole("button", { name: "2028-03-02", exact: true })
    .click();
  await expect(end).toHaveValue("2028-03-02");
  await start.fill("2028-02-29");
  await start.press("ArrowDown");
  await page.getByRole("heading", { name: "添加新的订阅" }).click();
  await expect(calendar).toHaveCount(0);
  const name = `日期测试 ${info.project.name}`;
  await page.getByLabel("订阅名称").fill(name);
  await page.getByRole("button", { name: "保存订阅" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const saved = (
    await (await page.request.get("/api/v1/subscriptions")).json()
  ).find((s: any) => s.name === name);
  expect(saved).toMatchObject({
    start: "2028-02-29",
    end: "2028-03-02",
    autoRenew: false,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
