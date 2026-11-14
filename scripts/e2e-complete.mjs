import { chromium } from "playwright-core";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
await page.reload();
await page.waitForTimeout(1000);
// close any open modals
for (const name of ["取消", "关闭", "完成"]) {
  const btn = page.getByRole("button", { name, exact: true });
  if (await btn.count()) {
    try { await btn.first().click(); } catch {}
  }
}
const boxes = page.locator('button[title="完成（级联子任务）"]');
console.log("checkboxes:", await boxes.count());
for (let i = 0; i < await boxes.count(); i++) {
  console.log(i, await boxes.nth(i).getAttribute("title"));
}
if (await boxes.count()) {
  await boxes.first().click();
  await page.waitForTimeout(1000);
  console.log("body has 0 承诺:", (await page.locator("body").innerText()).includes("0 承诺"));
  await page.getByRole("button", { name: "周统计", exact: true }).click();
  await page.waitForTimeout(400);
  console.log((await page.locator("body").innerText()).slice(-700));
}
await browser.close();
