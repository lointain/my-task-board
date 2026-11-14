import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
page.on("console", (msg) => console.log("console:", msg.type(), msg.text()));
page.on("pageerror", (error) => console.log("pageerror:", error.message));
await page.reload();
await page.waitForTimeout(1500);

const rows = page.locator("div").filter({ hasText: /^测试项目$/ });
console.log("rows:", await rows.count());
const row = rows.first();
console.log("row box:", await row.boundingBox());
await row.click({ button: "right" });
await page.waitForTimeout(600);
console.log("body has 拆解:", (await page.locator("body").innerText()).includes("拆解"));
console.log("buttons:", await page.getByRole("button").allTextContents());
const fixed = await page.locator("div.fixed").last().innerText().catch(() => "none");
console.log("last fixed:", fixed);
await browser.close();
