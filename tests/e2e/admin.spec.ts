import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const localVars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const adminUsername = localVars.ADMIN_USERNAME;
const adminPassword = localVars.E2E_ADMIN_PASSWORD;
const pngFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3p8AAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("管理员账号").fill(adminUsername);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "内容管理" })).toBeVisible();
}

test("admin profile text, avatar and PDF persist through public API", async ({ page }) => {
  await login(page);
  const original = await page.evaluate(async () => {
    const response = await fetch("/api/admin/profile");
    const payload = await response.json();
    const { display_name, headline, intro, location, wechat_id, avatar_key, resume_key } = payload.data;
    return { display_name, headline, intro, location, wechat_id, avatar_key, resume_key };
  });

  try {
    await page.getByRole("link", { name: "个人资料", exact: true }).click();
    await expect(page.getByRole("heading", { name: "个人资料" })).toBeVisible();
    await page.getByLabel("个人介绍").fill("端到端测试资料，验证数据库持久化。");
    await page.locator(".admin-upload-field input[type=file]").nth(0).setInputFiles({
      name: "test-avatar.png",
      mimeType: "image/png",
      buffer: pngFixture,
    });
    await expect(page.getByAltText("当前头像预览")).toBeVisible();
    await page.locator(".admin-upload-field input[type=file]").nth(1).setInputFiles({
      name: "test-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n% local test resume\n%%EOF"),
    });
    await expect(page.getByText("简历文件已上传")).toBeVisible();
    await page.getByRole("button", { name: "保存资料" }).click();
    await expect(page.getByText("资料已保存。重新加载公开页面即可验证。")).toBeVisible();

    await page.goto("/");
    await expect(page.locator(".hero-intro")).toContainText("端到端测试资料，验证数据库持久化。");
    const avatar = page.locator(".portrait-image");
    await expect(avatar).toBeVisible();
    await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const resumeLink = page.locator("a[download]");
    await expect(resumeLink).toHaveAttribute("href", /\/media\/resume\//);
    const pdfResponse = await page.request.get(await resumeLink.getAttribute("href") ?? "");
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
  } finally {
    await page.evaluate(async (profile) => {
      await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
    }, original);
  }
});

test("admin can create a published project with an uploaded inline image", async ({ page }) => {
  const slug = `admin-media-${Date.now()}`;
  const title = `后台图片测试 ${Date.now()}`;
  let saved = false;
  await login(page);

  try {
    await page.getByRole("link", { name: "项目", exact: true }).click();
    await page.getByRole("button", { name: "新建项目" }).click();
    await page.getByLabel("标题").fill(title);
    await page.getByLabel("链接标识（slug）").fill(slug);
    await page.getByLabel("摘要").fill("验证后台文字、图片上传与公开展示。");
    await page.getByLabel("技术标签").fill("React, TypeScript");
    await page.getByLabel("领域标签").fill("后台验收");
    await page.getByLabel("发布状态").selectOption("published");
    const body = page.getByLabel("正文（支持 Markdown）");
    await body.fill("正文上传图像测试。");
    await body.focus();
    await body.press("End");
    await page.locator(".admin-record-editor input[type=file]").nth(1).setInputFiles({
      name: "inline-test.png",
      mimeType: "image/png",
      buffer: pngFixture,
    });
    await expect(body).toHaveValue(/!\[inline-test\.png\]\(\/media\/content-image\//);
    const validity = await page.locator(".admin-record-editor").evaluate((form: HTMLFormElement) => ({
      valid: form.checkValidity(),
      invalid: Array.from(form.elements)
        .filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
          "checkValidity" in element && !element.checkValidity())
        .map((element) => ({ name: element.getAttribute("aria-label"), value: element.value })),
    }));
    expect(validity.valid, JSON.stringify(validity.invalid)).toBe(true);
    const saveButton = page.getByRole("button", { name: "保存", exact: true });
    await saveButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await saveButton.click();
    await expect(page.getByText("内容已保存；公开页面重新加载后会读取最新数据。")).toBeVisible();
    saved = true;

    await page.goto(`/projects/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(".markdown-content")).toContainText("正文上传图像测试。");
    const image = page.locator(".markdown-content img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(".markdown-content img")).toBeVisible();
  } finally {
    if (saved) {
      page.once("dialog", (dialog) => dialog.accept());
      await page.goto("/admin/projects");
      await expect(page.getByRole("heading", { name: "项目" })).toBeVisible();
      await page.getByRole("button", { name: `删除${title}` }).click();
      await expect(page.getByRole("button", { name: `删除${title}` })).toHaveCount(0);
    }
  }
});
