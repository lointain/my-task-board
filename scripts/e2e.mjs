import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

const log = (...args) => console.log(...args);

try {
  await page.getByRole("button", { name: "项目", exact: true }).first().click();
  await page.getByPlaceholder("例如：TaskBoard 开发").fill("测试项目");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await page.waitForTimeout(700);
  log("after project:", (await page.locator("body").innerText()).includes("测试项目"));

  const row = page.locator("div").filter({ hasText: /^测试项目$/ }).first();
  await row.click();
  await row.click({ button: "right" });
  await page.getByRole("button", { name: "拆解", exact: true }).click();
  await page.waitForTimeout(500);
  log("decomp open:", await page.getByText("拆解：测试项目").count());

  await page.getByRole("button", { name: "新建子任务", exact: true }).click();
  await page.waitForTimeout(500);
  const input = page.locator('[data-decomp-task] input').last();
  await input.fill("子任务 A");
  await input.blur();
  await page.waitForTimeout(700);

  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.waitForTimeout(500);
  log("tree has child:", (await page.locator("body").innerText()).includes("子任务 A"));

  const svg = page.locator('svg[aria-label="重要性紧迫性四象限任务图"]');
  const childRow = page.locator("div").filter({ hasText: /^子任务 A$/ }).first();
  await childRow.dragTo(svg, { targetPosition: { x: 420, y: 260 } });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  log("after drag body has 承诺 count:", /(\d+) 个承诺/.exec(body)?.[0]);
  log("points:", await page.locator("g.chart-point").count());

  const point = page.locator("g.chart-point").first();
  if (await point.count()) {
    await point.dblclick();
    await page.waitForTimeout(500);
    log("detail open:", (await page.locator("body").innerText()).includes("任务详情"));
    await page.getByRole("button", { name: "取消", exact: true }).click();
  }

  log("ERRORS:", errors);
} catch (error) {
  console.error("FAILED", error);
  console.log("BODY:\n" + (await page.locator("body").innerText()).slice(0, 3000));
  console.log("ERRORS:", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
