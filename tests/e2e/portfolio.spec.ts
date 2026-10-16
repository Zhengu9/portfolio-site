import { expect, test } from "@playwright/test";

test("public portfolio routes render and remain within the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "谷久宁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /全栈开发工程师/ })).toBeVisible();
  await expect(page.locator(".admin-entry")).toBeVisible();
  await expect(page.getByRole("heading", { name: "船舶装备故障诊断智能问答系统" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "旷野智行无人车自主导航平台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "天盾 RAG 知识库安全防线" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ChronoSync 智能日程管理系统" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WeatherLens 天气图像分类系统" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  const secondPage = await page.locator(".home-content-panel").boundingBox();
  const projectGrid = await page.locator(".home-project-grid").boundingBox();
  expect(secondPage).not.toBeNull();
  expect(projectGrid).not.toBeNull();
  expect(projectGrid!.y + projectGrid!.height).toBeLessThanOrEqual(secondPage!.y + secondPage!.height + 1);
  await expect(page.getByText("按领域整理的技术实践，不设等级，不用分数定义能力。")).toHaveCount(0);
  expect(await page.locator(".home-project-grid .project-copy > p").evaluateAll((nodes) =>
    nodes.every((node) => getComputedStyle(node).display === "none"),
  )).toBe(true);

  await page.getByRole("button", { name: "微信联系" }).click();
  await expect(page.getByText("zhengu9", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "微信二维码待上传" })).toBeVisible();
  await expect(page.getByText("OPEN CHANNEL")).toHaveCount(0);
  await expect(page.getByText("添加时请备注来意，方便我及时确认。")).toHaveCount(0);
  await expect(page.locator(".contact-education")).toBeHidden();
  await expect(page.locator(".contact-admin-link")).toBeVisible();
  await page.getByRole("button", { name: "复制微信号" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();

  await page.getByRole("link", { name: "查看全部项目" }).click();
  await expect(page.getByRole("heading", { name: "项目实践" })).toBeVisible();
  await page.getByRole("link", { name: "船舶装备故障诊断智能问答系统" }).first().click();
  await expect(page.getByRole("heading", { name: "船舶装备故障诊断智能问答系统" })).toBeVisible();
  await page.getByRole("link", { name: /返回项目/ }).click();
  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole("link", { name: "博客" }).click();
  await expect(page.getByRole("heading", { name: "博客" })).toBeVisible();
});

test("admin sign-in page is available without exposing a fake authenticated session", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();
  await expect(page.getByLabel("管理员账号")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
