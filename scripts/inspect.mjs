import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const context = browser.contexts()[0];
const page = context.pages()[0];
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

await page.waitForTimeout(1200);
console.log("URL:", page.url());
console.log("TITLE:", await page.title());
console.log("BODY:\n" + (await page.locator("body").innerText()).slice(0, 4000));
console.log("ERRORS:", errors);
await browser.close();
