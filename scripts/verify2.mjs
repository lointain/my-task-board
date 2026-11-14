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

// --- 右侧树直接编辑：回车新建子任务 + 改名 ---
const treeRows = () => page.locator("aside [data-tree-row]");
const treeTitles = () =>
  page.$$eval("aside [data-tree-row]", (els) =>
    els.map((el) => el.querySelector("span.truncate")?.textContent?.trim() ?? ""),
  );
const focusedRowId = () =>
  page.evaluate(() => document.activeElement?.getAttribute("data-tree-row") ?? "");

await page.getByText(project, { exact: true }).last().click();
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
check(
  "回车新建子节点并进入改名",
  (await page.locator("aside [data-tree-row] input").count()) === 1,
);
await page.keyboard.type(childAName);
await page.keyboard.press("Enter");
await page.waitForTimeout(700);

// 焦点回到刚建的行，再回车建同级
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await page.keyboard.type(childBName);
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
const titlesAfterAdd = await treeTitles();
check(
  "再次回车建同级",
  titlesAfterAdd.includes(childAName) && titlesAfterAdd.includes(childBName),
  JSON.stringify(titlesAfterAdd.slice(-3)),
);

// --- 方向键导航 ---
const projectIndex = (await treeTitles()).indexOf(project);
await page.getByText(project, { exact: true }).last().click();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(300);
const rowIds = await page.$$eval("aside [data-tree-row]", (els) =>
  els.map((el) => el.getAttribute("data-tree-row")),
);
check("↓ 移动焦点", (await focusedRowId()) === rowIds[projectIndex + 1]);

await page.keyboard.press("ArrowUp");
await page.waitForTimeout(300);
check("↑ 移动焦点", (await focusedRowId()) === rowIds[projectIndex]);

// --- 折叠：←/→ ---
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(400);
const collapsedTitles = await treeTitles();
check(
  "← 折叠项目",
  !collapsedTitles.includes(childAName) && !collapsedTitles.includes(childBName),
  JSON.stringify(collapsedTitles.slice(-3)),
);
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
check("→ 展开项目", (await treeTitles()).includes(childAName));

// --- 改名状态下 ←/→ 只移动光标 ---
await page.getByText(childAName, { exact: true }).last().click();
await page.keyboard.press("F2");
await page.waitForTimeout(400);
const caretInput = page.locator("aside [data-tree-row] input").first();
const valueLen = (await caretInput.inputValue()).length;
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
const caret = await caretInput.evaluate((el) => el.selectionStart);
check("改名时 ← 只移动光标", caret === valueLen - 1, `caret=${caret} len=${valueLen}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// --- 回车插入到当前节点之后（不是末尾） ---
await page.getByText(childAName, { exact: true }).last().click();
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
await page.keyboard.type(childCName);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const afterEnter = (await treeTitles()).filter((title) =>
  [project, childAName, childBName, childCName].includes(title),
);
check(
  "回车插入到当前节点之后",
  afterEnter.join("|") === [project, childAName, childCName, childBName].join("|"),
  JSON.stringify(afterEnter),
);

// --- 拖动把手重排：把最后一个拖到第一个子节点之前 ---
await page.getByText(childBName, { exact: true }).last().scrollIntoViewIfNeeded();
await page.getByText(childAName, { exact: true }).last().scrollIntoViewIfNeeded();
const gripOf = (name) =>
  page
    .locator("aside [data-tree-row]")
    .filter({ hasText: name })
    .last()
    .locator("[data-tree-grip]");
const lastGrip = await gripOf(childBName).boundingBox();
const firstChildBox = await page
  .locator("aside [data-tree-row]")
  .filter({ hasText: childAName })
  .last()
  .boundingBox();
if (lastGrip && firstChildBox) {
  await page.mouse.move(lastGrip.x + lastGrip.width / 2, lastGrip.y + lastGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastGrip.x + 4, lastGrip.y + 12, { steps: 5 });
  await page.mouse.move(firstChildBox.x + 120, firstChildBox.y + 3, { steps: 12 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(900);
}
const afterDrag = (await treeTitles()).filter((title) =>
  [project, childAName, childBName, childCName].includes(title),
);
check(
  "树内拖动把手可排序",
  afterDrag.join("|") === [project, childBName, childAName, childCName].join("|"),
  JSON.stringify(afterDrag),
);

// --- Tab 缩进 / Space 完成 ---
await page.getByText(childCName, { exact: true }).last().click();
await page.keyboard.press("Tab");
await page.waitForTimeout(900);
const indent = await page.evaluate(() => {
  const row = document.activeElement;
  return row ? Number.parseFloat(row.style.paddingLeft || "0") : -1;
});
check("Tab 缩进", indent > 20, `paddingLeft=${indent}`);

await page.keyboard.press("Space");
await page.waitForTimeout(900);
const done = await page.evaluate(() =>
  Boolean(document.activeElement?.querySelector("span.line-through")),
);
check("Space 完成", done, `done=${done}`);
await page.keyboard.press("Space");
await page.waitForTimeout(700);
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
