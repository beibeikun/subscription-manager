import { test, expect } from "@playwright/test";
test("login, create subscription, view statistics, settings and archive", async ({
  page,
}, info) => {
  const choose = async (label: string, option: string) => {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-12345");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的订阅" })).toBeVisible();
  await page
    .getByRole("button", { name: "添加订阅", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "自定义订阅" }).click();
  await page.getByLabel("订阅名称").fill("测试音乐 " + info.project.name);
  await choose("付费模式", "永久买断");
  await expect(page.getByLabel("购买金额")).toBeVisible();
  await choose("付费模式", "周期订阅");
  await choose("分类", "未分类");
  await expect(
    page
      .getByRole("combobox", { name: "分类", exact: true })
      .locator(".category-color-dot"),
  ).toHaveCSS("background-color", "rgb(100, 116, 139)");
  await choose("快捷周期", "季付");
  await expect(page.getByLabel("每隔", { exact: true })).toHaveValue("3");
  await choose("周期单位", "周");
  await choose("快捷周期", "月付");
  await expect(page.getByLabel("每隔", { exact: true })).toHaveValue("1");
  await expect(
    page.getByRole("combobox", { name: "周期单位", exact: true }),
  ).toContainText("月");
  await choose("币种", "USD");
  await page.getByRole("combobox", { name: "币种", exact: true }).fill("CAD");
  await expect(
    page.getByRole("combobox", { name: "币种", exact: true }),
  ).toHaveValue("CAD");
  await page
    .getByRole("combobox", { name: "币种", exact: true })
    .press("Escape");
  await choose("币种", "CNY");
  await page.screenshot({
    path: `work/${info.project.name}-subscription-form.png`,
    fullPage: true,
  });
  await expect(page.locator("select, datalist")).toHaveCount(0);
  await page.getByLabel("每期金额").fill("25");
  await page.getByRole("button", { name: "保存订阅" }).click();
  await expect(
    page.getByRole("heading", { name: "测试音乐 " + info.project.name }),
  ).toBeVisible();
  const saved = (
    await (await page.request.get("/api/v1/subscriptions")).json()
  ).find(
    (subscription: any) =>
      subscription.name === "测试音乐 " + info.project.name,
  );
  expect(saved).toMatchObject({
    kind: "recurring",
    category: "未分类",
    rules: [{ amount: 2500, currency: "CNY", unit: "months", interval: 1 }],
  });
  const savedCard = page.locator(".sub-card").filter({
    has: page.getByRole("heading", { name: "测试音乐 " + info.project.name }),
  });
  await savedCard.hover();
  await savedCard.getByTitle("编辑", { exact: true }).click();
  await choose("修改生效方式", "从下一期变更（保留历史价格和周期）");
  await expect(
    page.getByRole("combobox", { name: "修改生效方式", exact: true }),
  ).toContainText("从下一期变更");
  await choose("修改生效方式", "修正录入错误（重新计算历史）");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  if (info.project.name === "desktop")
    await expect(page.locator(".sidebar")).toHaveCSS("width", "230px");
  await page.getByRole("combobox", { name: "订阅排序", exact: true }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const triggerRect = await page
    .getByRole("combobox", { name: "订阅排序", exact: true })
    .boundingBox();
  const menuRect = await page.getByRole("listbox").boundingBox();
  expect(Math.abs(menuRect!.x - triggerRect!.x)).toBeLessThan(2);
  expect(menuRect!.x + menuRect!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({
    path: `work/${info.project.name}-global-dropdown.png`,
    fullPage: false,
    animations: "disabled",
  });
  await page
    .getByRole("combobox", { name: "订阅排序", exact: true })
    .press("Escape");
  await choose("筛选分类", "未分类");
  await choose("筛选付费模式", "永久买断");
  await expect(
    page.getByRole("heading", { name: "测试音乐 " + info.project.name }),
  ).toHaveCount(0);
  await choose("筛选付费模式", "周期订阅");
  await choose("订阅排序", "按名称");
  await page.getByRole("button", { name: "支出统计", exact: true }).click();
  await choose("筛选分类", "未分类");
  await choose("筛选付费模式", "周期订阅");
  await expect(page.getByText("所选区间预计支出")).toBeVisible();
  await expect(page.locator(".calendar-logos .logo").first()).toBeVisible();
  await page.screenshot({
    path: `work/${info.project.name}-calendar.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "趋势", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "上一年", exact: true }).click();
  await page.getByRole("button", { name: "今年", exact: true }).click();
  await choose("趋势统计粒度", "按日");
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await page.getByRole("button", { name: "本月", exact: true }).click();
  await choose("趋势统计粒度", "按年");
  await expect(page.getByText("全部年份", { exact: false })).toBeVisible();
  await expect(page.locator('.range input[type="date"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "上一年", exact: true }),
  ).toHaveCount(0);

  await page.screenshot({
    path: `work/${info.project.name}-statistics.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "偏好设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bark 推送" })).toBeVisible();
  await choose("自动刷新", "关闭");
  await choose("自动刷新", "开启");
  await choose("刷新频率", "每周");
  await choose("刷新星期", "星期五");
  await page.getByLabel("刷新时间", { exact: true }).fill("18:30");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByLabel("刷新时间", { exact: true })).toHaveValue(
    "18:30",
  );
  await expect(page.getByText("设置已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "我的订阅" }).click();
  const card = page.locator(".sub-card").filter({
    has: page.getByRole("heading", { name: "测试音乐 " + info.project.name }),
  });
  await card.hover();
  await card.getByTitle("归档", { exact: true }).click();
  await expect(card).toHaveCount(0);
  await choose("筛选订阅状态", "已归档");
  await expect(card).toBeVisible();
  await card.hover();
  await card.getByTitle("恢复归档", { exact: true }).click();
  await expect(card).toHaveCount(0);
  await choose("筛选订阅状态", "有效订阅");
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "个人信息设置", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "个人信息", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("上传头像", { exact: true })
    .setInputFiles("public/icons/icon-192.png");
  await page.getByRole("button", { name: "使用图片", exact: true }).click();
  await expect(page.locator(".profile-avatar-preview img")).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "保存个人信息", exact: true }).click();
  await expect(page.getByText("个人信息已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".avatar-button img")).toBeVisible();
  await page.getByRole("button", { name: "个人信息设置", exact: true }).click();
  await page.screenshot({
    path: `work/${info.project.name}-profile.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
