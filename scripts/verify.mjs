/**
 * 手动 E2E 冒烟脚本：需要先运行 `pnpm tauri dev`，
 * 并以 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` 启动。
 *
 * 注意：debug 与 release 共用同一 bundle identifier 的 WebView2 user data folder，
 * 若已有实例在跑（尤其是 release 版），带不同浏览器参数再启动会报
 * `WebView2 error 0x8007139F`。此时用独立目录启动：
 *   $env:WEBVIEW2_USER_DATA_FOLDER="<repo>/.webview2-e2e"
 *
 *   node scripts/verify.mjs
 */
import { chromium } from "playwright-core";

const PORT = process.env.CDP_PORT ?? "9222";
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const checks = [];
const check = (name, ok, extra = "") => {
  checks.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const stamp = Date.now().toString().slice(-5);
const project = `项目 ${stamp}`;
const child = `子任务 ${stamp}`;

await page.reload();
await page.waitForTimeout(1200);

// 1. 新建项目
await page.getByRole("button", { name: "项目", exact: true }).first().click();
await page.getByPlaceholder("例如：TaskBoard 开发").fill(project);
await page.getByRole("button", { name: "创建", exact: true }).click();
await page.waitForTimeout(700);
const treeIdOf = (title) =>
  page.$$eval(
    "aside [data-tree-row]",
    (els, t) => els.find((el) => el.querySelector("input")?.value === t)?.getAttribute("data-tree-row") ?? "",
    title,
  );
check("新建项目", Boolean(await treeIdOf(project)));

// 2. 在右侧树里建子任务（行内输入框，回车新建）
const projectId = await treeIdOf(project);
await page.locator(`[data-tree-row="${projectId}"] input`).click();
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
await page.keyboard.type(child);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const childId = await treeIdOf(child);
check("拆解出子任务", Boolean(childId));

// 3. 拖把手到图上
const pointIndex = () =>
  page.$$eval(
    "g.chart-point",
    (els, name) => els.findIndex((el) => (el.getAttribute("aria-label") ?? "").startsWith(name)),
    child,
  );
const pointAt = async () => page.locator("g.chart-point").nth(await pointIndex());

const svg = page.locator("svg[data-chart-svg]");
const grip = page.locator(`[data-tree-row="${childId}"] [data-tree-grip]`);
await grip.scrollIntoViewIfNeeded();
const dragRowBox = await grip.boundingBox();
const svgBox = await svg.boundingBox();
if (!dragRowBox || !svgBox) throw new Error("no drag boxes");
await page.mouse.move(dragRowBox.x + dragRowBox.width / 2, dragRowBox.y + dragRowBox.height / 2);
await page.mouse.down();
await page.mouse.move(dragRowBox.x + 4, dragRowBox.y + 12, { steps: 4 });
await page.mouse.move(svgBox.x + svgBox.width * 0.4, svgBox.y + svgBox.height * 0.45, {
  steps: 10,
});
await page.waitForTimeout(250);
await page.mouse.up();
await page.waitForTimeout(1000);
check("拖入生成承诺点", (await pointIndex()) >= 0);

// 4. 拖动点并验证持久化
const point = await pointAt();
const circle = point.locator("circle.point-dot");
const box = await circle.boundingBox();
let before = "";
if (box) {
  // 先点一下选中（未选中的点拖不动），再拖。
  // 注意：刚落下时 transform 是 drop 处理器命令式写入的 2 位小数值，
  // 选中会触发一次 React 重渲染，之后读到的才是按紧迫度/重要度算出的稳定值，
  // 所以 before 必须在这次重渲染之后再取，否则和撤销后的值对不上。
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  before = await (await pointAt()).getAttribute("transform");
  const selectedBox = await circle.boundingBox();
  await page.mouse.move(selectedBox.x + selectedBox.width / 2, selectedBox.y + selectedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    selectedBox.x + selectedBox.width / 2 + 55,
    selectedBox.y + selectedBox.height / 2 - 35,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(900);
}
const after = await (await pointAt()).getAttribute("transform");
check("拖动点改变坐标", before !== after);

// 4.5 A1：Ctrl+Z 撤销 / Ctrl+Shift+Z 重做拖动
await page.mouse.click(5, 5);
await page.keyboard.press("Control+z");
await page.waitForTimeout(900);
const undoneTransform = await (await pointAt()).getAttribute("transform");
const undoSaid = await page
  .locator("div.fixed.bottom-12")
  .first()
  .innerText()
  .catch(() => "");
check(
  "A1 Ctrl+Z 撤销拖动",
  undoneTransform === before && undoSaid.includes("已撤销"),
  `${undoneTransform} / ${undoSaid}`,
);
await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(900);
check("A1 Ctrl+Shift+Z 重做拖动", (await (await pointAt()).getAttribute("transform")) === after);

await page.reload();
await page.waitForTimeout(1000);
const reloaded = await (await pointAt()).getAttribute("transform");
check("坐标持久化", reloaded === after);

// 5. 详情 + 笔记（说明默认就在，不再需要“添加说明”）
await (await pointAt()).locator("circle.point-dot").dblclick({ force: true });
await page.waitForTimeout(600);
check("详情默认带说明编辑器", (await page.locator(".tiptap").count()) === 1);
await page.locator(".tiptap").first().click();
await page.locator(".tiptap").first().type("冒烟笔记");
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(800);
await (await pointAt()).locator("circle.point-dot").dblclick({ force: true });
await page.waitForTimeout(500);
check("笔记保存", (await page.locator("body").innerText()).includes("冒烟笔记"));
await page.getByRole("button", { name: "取消", exact: true }).click();

// 6. 动量/截止日
await (await pointAt()).locator("circle.point-dot").click({ button: "right", force: true });
await page.waitForTimeout(300);
await page.getByRole("button", { name: "动量 / 截止日期", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="date"]').last().fill("2026-12-31");
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(900);
// A7 日期本地化后 zh-CN 显示为「12月31日」，不再输出 12-31
check("设置截止日", /12月31日|12-31|12\/31|Dec 31/.test(await page.locator("body").innerText()));

// 7. 完成 → 点消失、树保留
await page.locator(`[data-tree-row="${childId}"] button`).first().click();
await page.waitForTimeout(900);
check("完成后点图消失", (await pointIndex()) === -1);
check("完成后树保留", (await page.locator(`[data-tree-row="${childId}"] input`).count()) === 1);

// 8. 周统计
await page.getByRole("button", { name: "周统计", exact: true }).click();
await page.waitForTimeout(600);
const statsText = await page.locator("body").innerText();
check("周统计记录完成", /完成\s*\d+/.test(statsText) && statsText.includes("本周完成"));
await page.getByRole("button", { name: "关闭", exact: true }).last().click();
await page.waitForTimeout(500);

// 8.5 A5：已完成 / 已归档抽屉
await page.locator('button[title="已完成 / 已归档"]').click();
await page.waitForTimeout(600);
const drawer = page.locator("div.fixed.inset-0.z-40 aside");
const drawerText = await drawer.innerText().catch(() => "");
check(
  "A5 抽屉列出已完成任务",
  drawerText.includes("本周完成") && drawerText.includes(child) && drawerText.includes("取消完成"),
  drawerText.replace(/\n/g, " | ").slice(0, 100),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
check("A5 Esc 关闭抽屉", (await page.locator("div.fixed.inset-0.z-40 aside").count()) === 0);

// 9. 设置里的标签组
await page.locator('button[title="设置"]').click();
await page.waitForTimeout(400);
check("设置打开", (await page.locator("body").innerText()).includes("标签组"));
await page.getByRole("button", { name: "立即备份", exact: true }).click();
await page.waitForTimeout(1200);
check("备份可用", /data-\d{8}/.test(await page.locator("body").innerText()));

check("无运行时报错", errors.length === 0, errors.join(" | "));

console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} 通过`);
await browser.close();
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;


