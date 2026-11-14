import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.reload();
await page.waitForTimeout(1200);

const point = page.locator("g.chart-point").first();
console.log("points:", await point.count());
await point.locator("circle").last().dblclick();
await page.waitForTimeout(500);
console.log("detail:", (await page.locator("body").innerText()).includes("任务详情"));
const cancel = page.getByRole("button", { name: "取消", exact: true });
if (await cancel.count()) await cancel.click();
await page.waitForTimeout(300);

await point.locator("circle").last().click({ button: "right" });
await page.waitForTimeout(300);
await page.getByRole("button", { name: "动量 / 截止日期", exact: true }).click();
await page.waitForTimeout(300);
const dateInput = page.locator('input[type="date"]').last();
await dateInput.fill("2026-11-20");
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(900);
console.log("tree due:", (await page.locator("body").innerText()).includes("11/20"));

await point.locator("circle").last().dblclick();
await page.waitForTimeout(400);
console.log("detail due:", await page.locator('input[type="date"]').first().inputValue());
console.log("inheritance text:", (await page.locator("body").innerText()).includes("截止日"));

// Add note
const addNote = page.getByRole("button", { name: "添加说明", exact: true });
if (await addNote.count()) {
  await addNote.click();
  await page.waitForTimeout(300);
  const editor = page.locator(".tiptap").first();
  await editor.click();
  await editor.type("测试笔记内容");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForTimeout(800);
  await point.locator("circle").last().dblclick();
  await page.waitForTimeout(400);
  console.log("note saved:", (await page.locator("body").innerText()).includes("测试笔记内容"));
  await page.getByRole("button", { name: "取消", exact: true }).click();
}

// Complete via tree checkbox: locate row text then checkbox button
const row = page.locator("div").filter({ hasText: /^子任务 A$/ }).last();
if (await row.count()) {
  await row.locator("button").nth(1).click();
  await page.waitForTimeout(800);
  console.log("stats after complete:", (await page.locator("body").innerText()).includes("0 承诺"));
}

await page.getByRole("button", { name: "周统计", exact: true }).click();
await page.waitForTimeout(500);
console.log("stats modal:", (await page.locator("body").innerText()).includes("周统计"));
console.log((await page.locator("body").innerText()).slice(0, 1200));

console.log("ERRORS:", errors);
await browser.close();
