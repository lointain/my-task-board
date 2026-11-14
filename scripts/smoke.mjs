import { chromium } from "playwright-core";

const url = process.env.TASKBOARD_URL ?? "http://127.0.0.1:1420";
const edge =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(String(error)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".tiptap", { timeout: 10_000 });
await page.waitForTimeout(500);

const result = {
  title: await page.title(),
  points: await page.locator(".chart-point").count(),
  hasChartTitle: (await page.locator("body").innerText()).includes("任务全景"),
  hasTaskTitle: (await page.locator("body").innerText()).includes("把选型落成骨架"),
  hasNote: (await page.locator(".tiptap").innerText()).includes("本周清单"),
  consoleErrors,
};

await page.screenshot({ path: "docs/preview-browser.png", fullPage: false });
await browser.close();

console.log(JSON.stringify(result, null, 2));

if (result.points < 5 || !result.hasChartTitle || !result.hasTaskTitle || !result.hasNote) {
  process.exitCode = 1;
}
if (consoleErrors.length > 0) {
  process.exitCode = 1;
}
