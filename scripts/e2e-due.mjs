import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.reload();
await page.waitForTimeout(900);

await page.getByRole("button", { name: "项目", exact: true }).first().click();
await page.getByPlaceholder("例如：TaskBoard 开发").fill("继承测试");
await page.getByRole("button", { name: "创建", exact: true }).click();
await page.waitForTimeout(600);

const row = page.getByText("继承测试", { exact: true }).last();
await row.dblclick();
await page.waitForTimeout(400);
await page.locator('input[type="date"]').first().fill("2026-11-10");
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(800);

await row.click({ button: "right" });
await page.getByRole("button", { name: "拆解", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "新建子任务", exact: true }).click();
await page.waitForTimeout(400);
const input = page.locator("[data-decomp-task] input").last();
await input.fill("继承子任务");
await input.blur();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "完成", exact: true }).click();
await page.waitForTimeout(500);

const child = page.getByText("继承子任务", { exact: true }).last();
await child.dblclick();
await page.waitForTimeout(400);
const body = await page.locator("body").innerText();
console.log("inherits:", body.includes("继承自「继承测试」"));
console.log("due input empty:", await page.locator('input[type="date"]').first().inputValue());
await page.getByRole("button", { name: "取消", exact: true }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: "周统计", exact: true }).click();
await page.waitForTimeout(500);
const stats = await page.locator("body").innerText();
console.log("overdue count:", /逾期\s*(\d+)/.exec(stats)?.[1]);
console.log("overdue item:", stats.includes("继承子任务"));
console.log("ERRORS:", errors);
await browser.close();
