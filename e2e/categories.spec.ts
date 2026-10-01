import { test, expect } from "@playwright/test";

test("settings category dropdown protects used categories and deletes unused ones", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的订阅" })).toBeVisible();
  const { csrf } = await (await page.request.get("/api/v1/auth/me")).json();
  const headers = { "x-csrf-token": csrf };
  const name = "分类测试 " + info.project.name;
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  const dropdown = page.getByLabel("订阅分类", { exact: true });
  const choose = async (name: string) => {
    if ((await dropdown.getAttribute("aria-expanded")) !== "true")
      await dropdown.click();
    await page
      .getByRole("option")
      .filter({ hasText: name || "新增分类" })
      .click();
  };
  await choose("");
  await page.getByLabel("新分类名称", { exact: true }).fill(name);
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await dropdown.click();
  await expect(page.locator(".category-settings-panel")).toHaveCSS("overflow", "visible");
  await expect(page.getByRole("option").filter({ hasText: name })).toHaveCount(
    1,
  );
  await choose(name);
  await expect(
    page.getByRole("button", { name: "删除分类", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("分类颜色").fill("#123456");
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(page.getByText("分类已保存", { exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/categories")).json()).find(
          (c: any) => c.name === name,
        )?.color,
    )
    .toBe("#123456");
  await expect(dropdown.locator(".category-color-dot")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await dropdown.click();
  await expect(
    page
      .getByRole("option")
      .filter({ hasText: name })
      .locator(".category-color-dot"),
  ).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await page.screenshot({
    path: `work/${info.project.name}-category-dropdown.png`,
    fullPage: true,
  });
  await dropdown.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await dropdown.press("ArrowDown");
  await dropdown.press("Home");
  await dropdown.press("Enter");
  await expect(dropdown).toContainText("新增分类");
  await dropdown.click();
  await page.getByRole("heading", { name: "订阅分类", exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  const response = await page.request.post("/api/v1/subscriptions", {
    headers,
    data: {
      name: "归档订阅",
      kind: "recurring",
      start: "2026-01-01",
      autoRenew: true,
      archived: true,
      category: name,
      rules: [
        {
          effective: "2026-01-01",
          amount: 100,
          currency: "CNY",
          unit: "months",
          interval: 1,
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  const subscription = await response.json();
  await page.reload();
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  await choose(name);
  await expect(
    page.getByRole("button", { name: "删除分类", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("该分类已有订阅项目使用，不能删除（包含归档订阅）。", {
      exact: true,
    }),
  ).toBeVisible();
  await choose("未分类");
  await expect(
    page.getByRole("button", { name: "删除分类", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await page.request.delete("/api/v1/subscriptions/" + subscription.id, {
        headers,
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  await choose(name);
  await page.getByRole("button", { name: "删除分类", exact: true }).click();
  await expect(dropdown).toContainText("新增分类");
  await dropdown.click();
  await expect(page.getByRole("option").filter({ hasText: name })).toHaveCount(
    0,
  );
  await dropdown.press("Escape");
  await expect(dropdown).toContainText("新增分类");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
