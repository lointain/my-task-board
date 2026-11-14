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
await page.locator('button[title="设置"]').click();
await page.waitForTimeout(400);
console.log("settings open:", (await page.locator("body").innerText()).includes("标签组"));

const groupInput = page.getByPlaceholder("新标签组名称");
await groupInput.fill("测试属性");
await page.getByRole("button", { name: "新建组", exact: true }).click();
await page.waitForTimeout(700);
console.log("group created:", (await page.locator("body").innerText()).includes("测试属性"));

const draft = page.getByPlaceholder("新增标签…").last();
await draft.fill("测试标签");
await draft.press("Enter");
await page.waitForTimeout(700);
console.log("tag created:", (await page.locator("body").innerText()).includes("测试标签"));

await page.getByRole("button", { name: "立即备份", exact: true }).click();
await page.waitForTimeout(1000);
const body = await page.locator("body").innerText();
console.log("backup result:", body.includes("backups") || body.includes("data-"));
console.log("error toast:", await page.locator("text=关闭").count());
console.log("ERRORS:", errors);
await browser.close();
