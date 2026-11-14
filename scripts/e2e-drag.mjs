import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.reload();
await page.waitForTimeout(1000);

// create project
await page.getByRole("button", { name: "项目", exact: true }).first().click();
await page.getByPlaceholder("例如：TaskBoard 开发").fill("拖拽测试");
await page.getByRole("button", { name: "创建", exact: true }).click();
await page.waitForTimeout(700);

// context menu -> decompose
const row = page.locator("div").filter({ hasText: /^拖拽测试$/ }).last();
await row.click({ button: "right" });
await page.getByRole("button", { name: "拆解", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "新建子任务", exact: true }).click();
await page.waitForTimeout(400);
const input = page.locator("[data-decomp-task] input").last();
await input.fill("拖拽任务");
await input.blur();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "完成", exact: true }).click();
await page.waitForTimeout(400);

const svg = page.locator('svg[aria-label="重要性紧迫性四象限任务图"]');
const child = page.locator("div").filter({ hasText: /^拖拽任务$/ }).last();
await child.dragTo(svg, { targetPosition: { x: 300, y: 300 } });
await page.waitForTimeout(900);
console.log("points:", await page.locator("g.chart-point").count());

const point = page.locator("g.chart-point").first();
const circle = point.locator("circle").last();
const before = await point.getAttribute("transform");
const box = await circle.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(900);
}
const after = await point.getAttribute("transform");
console.log("before:", before);
console.log("after:", after);
await page.reload();
await page.waitForTimeout(900);
const reloaded = await page.locator("g.chart-point").first().getAttribute("transform");
console.log("reloaded:", reloaded === after);
console.log("ERRORS:", errors);
await browser.close();
