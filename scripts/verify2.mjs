import { chromium } from "playwright-core";

const PORT = process.env.CDP_PORT ?? "9222";
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const checks = [];
const check = (name, ok, extra = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

await page.reload();
await page.waitForTimeout(1500);

const stamp = Date.now().toString().slice(-5);
const project = `拖拽测试 ${stamp}`;
const childAName = `子任务A-${stamp}`;
const childBName = `子任务B-${stamp}`;
const childCName = `子任务C-${stamp}`;
const pointTitles = () =>
  page.$$eval("g.chart-point", (els) => els.map((el) => el.getAttribute("aria-label") ?? ""));

await page.getByRole("button", { name: "项目", exact: true }).first().click();
await page.getByPlaceholder("例如：TaskBoard 开发").fill(project);
await page.getByRole("button", { name: "创建", exact: true }).click();
await page.waitForTimeout(800);

// 右键 → 拆解
await page.getByText(project, { exact: true }).last().click({ button: "right" });
await page.getByRole("button", { name: "拆解", exact: true }).click();
await page.waitForTimeout(500);

// --- 根节点快捷键：回车应新建子节点并聚焦 ---
const rootInput = page.locator("[data-decomp-task] input").first();
await rootInput.click();
await rootInput.press("Enter");
await page.waitForTimeout(900);
const rowCount = await page.locator("[data-decomp-task]").count();
check("根节点回车新建子节点", rowCount === 2, `rows=${rowCount}`);

// 新节点已聚焦，直接改名
await page.keyboard.type(childAName);
await page.keyboard.press("Tab"); // 已经是子节点，Tab 无同级可缩进 → 不应崩
await page.waitForTimeout(400);
await page.locator("[data-decomp-task] input").first().blur().catch(() => {});
await page.waitForTimeout(600);

// 再给根加一个子节点：聚焦根，回车
await rootInput.click();
await rootInput.press("Enter");
await page.waitForTimeout(800);
await page.keyboard.type(childBName);
await page.locator("[data-decomp-task] input").first().click();
await page.waitForTimeout(800);
const rowsAfter = await page.locator("[data-decomp-task]").count();
check("再次回车再建一个子节点", rowsAfter === 3, `rows=${rowsAfter}`);

// --- 方向键导航 ---
const inputs = page.locator("[data-decomp-task] input");
await inputs.nth(0).click();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(300);
const focusedIndex = await page.evaluate(() => {
  const all = [...document.querySelectorAll("[data-decomp-task] input")];
  return all.indexOf(document.activeElement);
});
check("↓ 移动焦点", focusedIndex === 1, `focused=${focusedIndex}`);

await page.keyboard.press("ArrowUp");
await page.waitForTimeout(300);
const backIndex = await page.evaluate(() => {
  const all = [...document.querySelectorAll("[data-decomp-task] input")];
  return all.indexOf(document.activeElement);
});
check("↑ 移动焦点", backIndex === 0, `focused=${backIndex}`);

// --- 折叠：Alt+← / Alt+→（←/→ 留给光标） ---
await page.keyboard.press("Alt+ArrowLeft");
await page.waitForTimeout(400);
const collapsedRows = await page.locator("[data-decomp-task]").count();
check("Alt+← 折叠根节点", collapsedRows === 1, `rows=${collapsedRows}`);
await page.keyboard.press("Alt+ArrowRight");
await page.waitForTimeout(400);
const expandedRows = await page.locator("[data-decomp-task]").count();
check("Alt+→ 展开根节点", expandedRows === 3, `rows=${expandedRows}`);

// --- ←/→ 只移动光标，不再折叠 ---
const caretInput = page.locator("[data-decomp-task] input").nth(1);
await caretInput.click();
const valueLen = (await caretInput.inputValue()).length;
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
const caret = await caretInput.evaluate((el) => el.selectionStart);
check("← 只移动光标", caret === valueLen - 1, `caret=${caret} len=${valueLen}`);

// --- 回车插入到当前节点之后（不是末尾） ---
const decompTitles = () =>
  page.$$eval("[data-decomp-task] input", (els) => els.map((el) => el.value));
await page.locator("[data-decomp-task] input").nth(1).click();
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
await page.keyboard.type(childCName);
await page.locator("[data-decomp-task] input").nth(0).click();
await page.waitForTimeout(700);
const afterEnter = await decompTitles();
check(
  "回车插入到当前节点之后",
  afterEnter[0] === project &&
    afterEnter[1] === childAName &&
    afterEnter[2] === childCName &&
    afterEnter[3] === childBName,
  JSON.stringify(afterEnter),
);

// --- 拖动重排：把最后一个拖到第一个子节点之前 ---
const rowEls = page.locator("[data-decomp-task]");
const lastBox = await rowEls.nth(3).boundingBox();
const firstChildBox = await rowEls.nth(1).boundingBox();
if (lastBox && firstChildBox) {
  await page.mouse.move(lastBox.x + 12, lastBox.y + lastBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastBox.x + 12, lastBox.y + 8, { steps: 5 });
  await page.mouse.move(firstChildBox.x + 100, firstChildBox.y + 2, { steps: 12 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(900);
}
const afterDrag = await decompTitles();
check(
  "拆解界面可拖动排序",
  afterDrag[1] === childBName && afterDrag[2] === childAName && afterDrag[3] === childCName,
  JSON.stringify(afterDrag),
);

await page.getByRole("button", { name: "完成", exact: true }).click();
await page.waitForTimeout(500);

// --- 指针拖拽：树 → 图 ---
const svg = page.locator('svg[aria-label="重要性紧迫性四象限任务图"]');
const childRow = page.getByText(childAName, { exact: true }).last();
await childRow.scrollIntoViewIfNeeded();
const rowBox = await childRow.boundingBox();
const svgBox = await svg.boundingBox();
if (!rowBox || !svgBox) throw new Error("no boxes");

const pointsBefore = await page.locator("g.chart-point").count();
await page.mouse.move(rowBox.x + 60, rowBox.y + rowBox.height / 2);await page.mouse.down();
await page.mouse.move(rowBox.x + 20, rowBox.y, { steps: 3 });
await page.mouse.move(svgBox.x + svgBox.width * 0.45, svgBox.y + svgBox.height * 0.4, {
  steps: 12,
});
await page.waitForTimeout(300);
const ghostVisible = await page.locator("text=松开").count();
await page.mouse.up();
await page.waitForTimeout(1200);

const toastCount = await page.locator("div.fixed.bottom-12").count();
if (toastCount) {
  console.log("TOAST:", await page.locator("div.fixed.bottom-12").innerText());
}
const points = await pointTitles();
const mine = points.filter((t) => t.startsWith(childAName)).length;
check("拖到图上创建承诺点", mine === 1, `titles=${JSON.stringify(points)}`);
check("拖拽过程显示投放提示", ghostVisible > 0);

// --- 横轴方向：Q1 在左，紧迫度 100 在左 ---
const axis = await page.evaluate(() => {
  const svg = document.querySelector("svg[data-chart-svg]");
  const labels = [...svg.querySelectorAll("text")].filter((t) => /^Q\d/.test(t.textContent ?? ""));
  const q1 = labels.find((t) => (t.textContent ?? "").startsWith("Q1"));
  return { q1x: Number(q1?.getAttribute("x")), anchor: q1?.getAttribute("text-anchor") };
});
check("Q1 在左侧", axis.anchor === "start" && axis.q1x < 40, JSON.stringify(axis));

// --- 悬浮 tooltip 有详情 ---
const firstPoint = page.locator("g.chart-point").first();
const firstCircle = await firstPoint.locator("circle").last().boundingBox();
await page.mouse.move(firstCircle.x + firstCircle.width / 2, firstCircle.y + firstCircle.height / 2);
await page.waitForTimeout(500);
const tipText = await page
  .locator("div.absolute.z-30")
  .first()
  .innerText()
  .catch(() => "");
check(
  "悬浮显示详细 tooltip",
  tipText.includes("紧迫") && tipText.includes("重要") && /Q1|Q2|Q3|Q4/.test(tipText),
  tipText.replace(/\n/g, " | ").slice(0, 120),
);

// --- 指针拖拽：树 → 未来的日板标签（周日） ---
const sundayTab = page.locator('[data-drop-board="sun"]');
const sundayBox = await sundayTab.boundingBox();
const childBRow = page.getByText(childBName, { exact: true }).last();
await childBRow.scrollIntoViewIfNeeded();
const rowBBox = await childBRow.boundingBox();
await page.mouse.move(rowBBox.x + 60, rowBBox.y + rowBBox.height / 2);
await page.mouse.down();
await page.mouse.move(rowBBox.x + 10, rowBBox.y - 10, { steps: 3 });
await page.mouse.move(sundayBox.x + sundayBox.width / 2, sundayBox.y + sundayBox.height / 2, {
  steps: 12,
});
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(1200);
const boardTitle = await page.locator("h1").first().innerText();
check("拖到周日标签 → 切到周日", boardTitle.includes("周日"), boardTitle);
const sunTitles = await pointTitles();
check(
  "周日板上出现该任务",
  sunTitles.filter((t) => t.startsWith(childBName)).length === 1,
  `titles=${JSON.stringify(sunTitles)}`,
);

// --- 过去日期不是投放目标 ---
const pastTab = page.locator('[data-drop-board="mon"]');
check("周一（已过去）不是投放目标", (await pastTab.count()) === 0);

// --- TipTap 编辑器：待办列表 + 文本可选中（拖动排序已按需求关闭） ---
await page.getByText(childAName, { exact: true }).last().dblclick();
await page.waitForTimeout(700);
check("详情已打开", (await page.locator("body").innerText()).includes("任务详情"));
const addNote = page.getByRole("button", { name: "添加说明", exact: true });
if (await addNote.count()) {
  await addNote.click();
  await page.waitForTimeout(400);
  const editor = page.locator(".tiptap").first();
  await editor.click();
  await page.keyboard.type("[] ");
  await page.keyboard.type("一");
  await page.keyboard.press("Enter");
  await page.keyboard.type("二");
  await page.keyboard.press("Enter");
  await page.keyboard.type("三");
  await page.waitForTimeout(500);

  const items = page.locator('.tiptap ul[data-type="taskList"] > li');
  const itemCount = await items.count();
  check("[] 生成待办列表", itemCount === 3, `items=${itemCount}`);

  // 拖选一段文字，确认编辑器里能正常选中（不被拖拽组件干扰）
  const firstPara = page.locator('.tiptap li[data-checked] p').first();
  const pb = await firstPara.boundingBox();
  if (pb) {
    await page.mouse.move(pb.x + 2, pb.y + pb.height / 2);
    await page.mouse.down();
    await page.mouse.move(pb.x + pb.width - 4, pb.y + pb.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  const selection = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  check("编辑器文本可选中", selection.length > 0, JSON.stringify(selection));
  check("没有拖拽把手残留", (await page.locator("[data-editor-grip]").count()) === 0);
}
await page.getByRole("button", { name: "取消", exact: true }).click();

check("无运行时报错", errors.length === 0, errors.join(" | "));

console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} 通过`);
await browser.close();
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
