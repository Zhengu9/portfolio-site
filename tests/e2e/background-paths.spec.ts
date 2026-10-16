import { expect, test, type Locator, type Page } from "@playwright/test";

async function verifyForegroundScreenshot(page: Page, text: Locator, path: string) {
  const bounds = await text.boundingBox();
  expect(bounds).not.toBeNull();
  const screenshot = await page.screenshot({ path, scale: "css" });
  // DOM visibility does not catch compositor frames that omit foreground text.
  const brightPixels = await page.evaluate(async ({ image, bounds }) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${image}`;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Screenshot pixel check requires a canvas context");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(
      Math.max(0, Math.floor(bounds.x)), Math.max(0, Math.floor(bounds.y)),
      Math.ceil(bounds.width), Math.ceil(bounds.height),
    );
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 170 && data[index + 1] > 170 && data[index + 2] > 170) count++;
    }
    return count;
  }, { image: screenshot.toString("base64"), bounds: bounds! });
  expect(brightPixels, "Foreground heading must be painted above the animated background").toBeGreaterThan(100);
}

test("background paths animate only on the active first and third pages", async ({ page }, testInfo) => {
  await page.goto("/");
  const hero = page.locator(".light-trails-hero");
  const contact = page.locator(".light-trails-contact");
  const heroPath = hero.locator("path").nth(20);
  const contactPath = contact.locator("path").nth(20);

  await expect(page.locator(".light-trails")).toHaveCount(2);
  await expect(page.locator(".home-content-panel .light-trails")).toHaveCount(0);
  await expect(page.locator(".contact-page-heading h2")).toHaveText("从一个问题，");
  for (const background of [hero, contact]) {
    await expect(background.locator("svg")).toHaveCount(2);
    await expect(background.locator("path")).toHaveCount(72);
    await expect(background).toHaveAttribute("aria-hidden", "true");
    await expect(background).toHaveCSS("pointer-events", "none");
  }
  await expect(heroPath).toHaveCSS("animation-play-state", "running");
  await expect(contactPath).toHaveCSS("animation-play-state", "paused");
  await expect.poll(() => contact.evaluate((element) => getComputedStyle(element).maskImage))
    .not.toBe("none");
  const contactOpacity = Number(await contact.evaluate((element) => getComputedStyle(element).opacity));
  const heroOpacity = Number(await hero.evaluate((element) => getComputedStyle(element).opacity));
  expect(contactOpacity).toBeLessThan(heroOpacity);
  const initialOffset = await heroPath.evaluate((path) => getComputedStyle(path).strokeDashoffset);
  await expect.poll(() => heroPath.evaluate((path) => getComputedStyle(path).strokeDashoffset))
    .not.toBe(initialOffset);
  await expect(page.locator(".home-hero-panel .page-motion")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-copy")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "谷久宁" })).toBeInViewport();
  await verifyForegroundScreenshot(page, page.locator(".hero-name"), testInfo.outputPath("hero-paths.png"));

  await page.getByRole("button", { name: "微信联系" }).click();
  await expect(page.locator(".home-project-panel")).toHaveClass(/is-current/);
  await expect(page.getByRole("button", { name: "复制微信号" })).toBeInViewport();
  await expect(heroPath).toHaveCSS("animation-play-state", "paused");
  await expect(contactPath).toHaveCSS("animation-play-state", "running");
  await expect(page.locator(".home-project-panel .page-motion")).toHaveCSS("opacity", "1");
  const dynamicHeadline = page.getByRole("heading", { name: "从一个问题，开始交流。" });
  const typedCharacters = dynamicHeadline.locator(".contact-typewriter-character");
  await expect.poll(() => typedCharacters.count()).toBeGreaterThan(0);
  await expect(typedCharacters.first()).toHaveText("开");
  const lastCharacter = typedCharacters.last();
  await expect.poll(async () => {
    const characterBounds = await lastCharacter.boundingBox();
    const caretBounds = await dynamicHeadline.locator(".contact-typewriter-caret").boundingBox();
    return characterBounds && caretBounds ? caretBounds.x - characterBounds.x - characterBounds.width : -1;
  }).toBeGreaterThanOrEqual(0);
  await expect(dynamicHeadline.locator(".contact-typewriter-caret"))
    .toHaveCSS("animation-name", "contact-typewriter-blink");
  await expect(typedCharacters).toHaveCount(5, { timeout: 2000 });
  await page.waitForTimeout(900);
  await expect(typedCharacters).toHaveCount(5);
  await expect(typedCharacters).toHaveCount(0, { timeout: 1500 });
  await expect(typedCharacters).toHaveCount(1, { timeout: 1000 });
  await verifyForegroundScreenshot(page, page.locator(".contact-page-heading h2"), testInfo.outputPath("contact-paths.png"));
  await page.getByRole("button", { name: "复制微信号" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();

  if (await page.getByRole("button", { name: "打开导航菜单" }).isVisible()) {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
  }
  await page.getByRole("button", { name: "关于", exact: true }).click();
  await expect(page.locator(".home-hero-panel")).toHaveClass(/is-current/);
  await expect(heroPath).toHaveCSS("animation-play-state", "running");
});

for (const width of [375, 768, 1440]) {
  test(`reduced-motion paths stay static without overflow at ${width}px`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Explicit viewport sizes are covered by the desktop browser.");
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".light-trails-hero path").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".light-trails-contact path").first()).toHaveCSS("animation-name", "none");
    const staticPaths = await page.locator(".light-trails path").evaluateAll((paths) =>
      paths.every((path) => getComputedStyle(path).strokeDasharray === "none"),
    );
    expect(staticPaths).toBe(true);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    await page.screenshot({ path: testInfo.outputPath(`hero-static-${width}.png`) });
    await page.keyboard.press("End");
    await expect(page.locator(".home-project-panel")).toHaveClass(/is-current/);
    await expect(page.getByRole("button", { name: "复制微信号" })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "从一个问题，开始交流。" })).toBeVisible();
    await expect(page.locator(".contact-typewriter-character")).toHaveCount(5);
    await expect(page.locator(".contact-typewriter-caret")).toHaveCSS("animation-name", "none");
    await page.screenshot({ path: testInfo.outputPath(`contact-static-${width}.png`) });
  });
}
