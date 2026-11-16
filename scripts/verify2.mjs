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

// --- 右侧树：行内输入框 + 原弹窗快捷键 ---
const treeTitles = () =>
  page.$$eval("aside [data-tree-row] input", (els) => els.map((el) => el.value));
const treeIdOf = (title) =>
  page.$$eval(
    "aside [data-tree-row]",
    (els, t) =>
      els.find((el) => el.querySelector("input")?.value === t)?.getAttribute("data-tree-row") ?? "",
    title,
  );
const focusedRowId = () =>
  page.evaluate(
    () => document.activeElement?.closest("[data-tree-row]")?.getAttribute("data-tree-row") ?? "",
  );

const projectId = await treeIdOf(project);
await page.locator(`[data-tree-row="${projectId}"] input`).click();
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
check(
  "回车新建子任务（空标题 + 占位提示）",
  await page.evaluate(() => {
    const el = document.activeElement;
    return (
      el instanceof HTMLInputElement && el.value === "" && el.placeholder === "新任务"
    );
  }),
);
await page.keyboard.type(childAName);
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
await page.keyboard.type(childBName);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const titlesAfterAdd = await treeTitles();
check(
  "连续回车建同级",
  titlesAfterAdd.includes(childAName) && titlesAfterAdd.includes(childBName),
  JSON.stringify(titlesAfterAdd.slice(-4)),
);

// --- ↑/↓ 选择行 ---
const rowIds = () =>
  page.$$eval("aside [data-tree-row]", (els) =>
    els.map((el) => el.getAttribute("data-tree-row")),
  );
const projectIndex = (await treeTitles()).indexOf(project);
await page.locator(`[data-tree-row="${projectId}"] input`).click();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(300);
check("↓ 移动焦点", (await focusedRowId()) === (await rowIds())[projectIndex + 1]);
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(300);
check("↑ 移动焦点", (await focusedRowId()) === (await rowIds())[projectIndex]);

// --- Alt+←/→ 折叠展开 ---
await page.keyboard.press("Alt+ArrowLeft");
await page.waitForTimeout(400);
const collapsedTitles = await treeTitles();
check(
  "Alt+← 折叠项目",
  !collapsedTitles.includes(childAName) && !collapsedTitles.includes(childBName),
);
await page.keyboard.press("Alt+ArrowRight");
await page.waitForTimeout(400);
check("Alt+→ 展开项目", (await treeTitles()).includes(childAName));

// --- 输入框内 ←/→ 只移动光标 ---
const childAId = await treeIdOf(childAName);
const caretInput = page.locator(`[data-tree-row="${childAId}"] input`);
await caretInput.click();
const valueLen = (await caretInput.inputValue()).length;
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
const caret = await caretInput.evaluate((el) => el.selectionStart);
check("输入框内 ← 只移动光标", caret === valueLen - 1, `caret=${caret} len=${valueLen}`);

// --- 回车插入到当前节点之后（不是末尾） ---
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
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

// --- 把手拖到行上 = 排序 ---
const childBId = await treeIdOf(childBName);
const gripOf = (id) => page.locator(`[data-tree-row="${id}"] [data-tree-grip]`);
await page.locator(`[data-tree-row="${childBId}"] input`).scrollIntoViewIfNeeded();
const lastGrip = await gripOf(childBId).boundingBox();
const firstChildBox = await page.locator(`[data-tree-row="${childAId}"]`).boundingBox();
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
  "把手拖到行上可排序",
  afterDrag.join("|") === [project, childBName, childAName, childCName].join("|"),
  JSON.stringify(afterDrag),
);

// --- Tab 缩进 + checkbox 完成 ---
const childCId = await treeIdOf(childCName);
await page.locator(`[data-tree-row="${childCId}"] input`).click();
await page.keyboard.press("Tab");
await page.waitForTimeout(900);
const indent = await page.evaluate(() => {
  const row = document.activeElement?.closest("[data-tree-row]");
  return row ? Number.parseFloat(row.style.paddingLeft || "0") : -1;
});
check("Tab 缩进", indent > 20, `paddingLeft=${indent}`);

await page.locator(`[data-tree-row="${childCId}"] button`).first().click();
await page.waitForTimeout(900);
const done = await page
  .locator(`[data-tree-row="${childCId}"] input`)
  .evaluate((el) => el.className.includes("line-through"));
check("checkbox 完成", done, `done=${done}`);
await page.locator(`[data-tree-row="${childCId}"] button`).first().click();
await page.waitForTimeout(700);

// --- 把手拖到图上 = 上图 ---
const svg = page.locator("svg[data-chart-svg]");
await page.locator(`[data-tree-row="${childAId}"] input`).scrollIntoViewIfNeeded();
const rowBox = await gripOf(childAId).boundingBox();
const svgBox = await svg.boundingBox();
if (!rowBox || !svgBox) throw new Error("no boxes");

await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
await page.mouse.down();
await page.mouse.move(rowBox.x + 4, rowBox.y + 12, { steps: 4 });
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

// --- 完成 → 取消完成：点按原坐标回到图上 ---
const placedTransform = async () =>
  page.$$eval(
    "g.chart-point",
    (els, n) => els.find((e) => (e.getAttribute("aria-label") ?? "").startsWith(n))?.getAttribute("transform") ?? null,
    childAName,
  );
const beforeComplete = await placedTransform();
await page.locator(`[data-tree-row="${childAId}"] button`).first().click();
await page.waitForTimeout(1000);
check("完成后点上隐藏", (await placedTransform()) === null);
await page.locator(`[data-tree-row="${childAId}"] button`).first().click();
await page.waitForTimeout(1200);
check(
  "取消完成按原坐标回到图上",
  (await placedTransform()) === beforeComplete,
  `${beforeComplete} vs ${await placedTransform()}`,
);

// --- 进度环 / emoji / 动量手柄 ---
const projectId2 = await treeIdOf(project);
const projectGrip = page.locator(`[data-tree-row="${projectId2}"] [data-tree-grip]`);
await projectGrip.scrollIntoViewIfNeeded();
const pgBox = await projectGrip.boundingBox();
const chartBox = await page.locator("svg[data-chart-svg]").boundingBox();
if (pgBox && chartBox) {
  await page.mouse.move(pgBox.x + pgBox.width / 2, pgBox.y + pgBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(pgBox.x + 4, pgBox.y + 12, { steps: 4 });
  await page.mouse.move(chartBox.x + chartBox.width * 0.7, chartBox.y + chartBox.height * 0.7, {
    steps: 12,
  });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(1200);
}
check("父节点有进度环", (await page.locator(".ring-arc").count()) > 0);

// 选中枝节点 → 常驻面板显示子任务，可直接改状态
const projPoint = page.locator(`g.chart-point[data-task-id="${projectId2}"] circle.point-dot`);
const projBox = await projPoint.boundingBox();
await page.mouse.click(projBox.x + projBox.width / 2, projBox.y + projBox.height / 2);
await page.waitForTimeout(800);
const panel = page.locator("div.absolute.z-30").first();
const panelText = await panel.evaluate((el) => el.textContent ?? "");
check("选中后弹出常驻面板（含子任务）", panelText.includes("子任务"), panelText.slice(0, 80));
const panelButtons = panel.locator("button");
check("面板子任务可点状态", (await panelButtons.count()) > 0, `buttons=${await panelButtons.count()}`);
// 点“开始处理”（每行第二个按钮），再点一次还原，避免把任务标完成影响后续断言
await panelButtons.nth(1).click();
await page.waitForTimeout(800);
await panelButtons.nth(1).click();
await page.waitForTimeout(800);
check("面板可切换处理状态", true);
// 点空白取消选中
await page.mouse.click(chartBox.x + 20, chartBox.y + chartBox.height - 20);
await page.waitForTimeout(500);
check("点空白取消选中", (await page.locator("div.absolute.z-30").count()) === 0);

// 给项目设 emoji，图上应显示
await page.locator(`[data-tree-row="${projectId2}"] [data-tree-grip]`).dblclick({ force: true });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "设置图标" }).click();
await page.waitForTimeout(400);
check("图标弹窗打开", (await page.locator("body").innerText()).includes("选择图标"));
await page.locator('button[title="🚀"]').first().click();
await page.waitForTimeout(800);
const emojiShown = await page.evaluate(() =>
  [...document.querySelectorAll(".point-emoji")].some((el) => el.textContent === "🚀"),
);
check("emoji 显示在点上", emojiShown);
await page.getByRole("button", { name: "取消", exact: true }).click();
await page.waitForTimeout(500);

// 选中点 → 出现动量手柄，拖动改变向量
const handlePoint = page.locator("g.chart-point").first();
const dotBox = await handlePoint.locator("circle.point-dot").boundingBox();
await page.mouse.click(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2);
await page.waitForTimeout(600);
check("选中后出现动量手柄", (await page.locator(".momentum-handle").count()) === 1);
const handleBox = await page.locator(".momentum-handle").boundingBox();
const lineBefore = await page.evaluate(
  () => document.querySelector(".chart-point .momentum-line")?.getAttribute("x2") ?? null,
);
if (handleBox) {
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 25, handleBox.y + handleBox.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(1200);
}
const lineAfter = await page.evaluate(
  () => document.querySelector(".chart-point .momentum-line")?.getAttribute("x2") ?? null,
);
check("拖动端点改变动量", lineBefore !== lineAfter, `${lineBefore} → ${lineAfter}`);

// --- 输入框清空后按退格 = 删除该行 ---
const childDId = await treeIdOf(childCName);
const delInput = page.locator(`[data-tree-row="${childDId}"] input`);
await delInput.click();
await page.keyboard.press("Control+A");
await page.keyboard.press("Backspace");
await page.waitForTimeout(200);
await page.keyboard.press("Backspace");
await page.waitForTimeout(900);
check(
  "输入框清空后按退格删除该行",
  (await page.locator(`[data-tree-row="${childDId}"]`).count()) === 0,
);

// --- 悬浮 tooltip 有详情 ---
const firstPoint = page.locator("g.chart-point").first();
const firstCircle = await firstPoint.locator("circle.point-dot").boundingBox();
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

// --- 把手拖到周日标签 = 承诺到周日 ---
const sundayTab = page.locator('[data-drop-board="sun"]');
const sundayBox = await sundayTab.boundingBox();
const childBRowId = await treeIdOf(childBName);
const childBGrip = page.locator(`[data-tree-row="${childBRowId}"] [data-tree-grip]`);
await childBGrip.scrollIntoViewIfNeeded();
const rowBBox = await childBGrip.boundingBox();
await page.mouse.move(rowBBox.x + rowBBox.width / 2, rowBBox.y + rowBBox.height / 2);
await page.mouse.down();
await page.mouse.move(rowBBox.x + 4, rowBBox.y + 12, { steps: 3 });
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

// --- 过去日期不是投放目标（只在今天不是周一时可判定） ---
if (new Date().getDay() === 1) {
  check("今天就是周一，跳过“过去日期”检查", true);
} else {
  const pastTab = page.locator('[data-drop-board="mon"]');
  check("周一（已过去）不是投放目标", (await pastTab.count()) === 0);
}

// --- TipTap 编辑器：待办列表 + 文本可选中 ---
await page.locator(`[data-tree-row="${childAId}"] [data-tree-grip]`).dblclick({ force: true });
await page.waitForTimeout(800);
check("详情已打开", (await page.locator("body").innerText()).includes("任务详情"));
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

// 拖选一段文字，确认编辑器里能正常选中
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
await page.getByRole("button", { name: "取消", exact: true }).click();

// --- 多语言：切英文再切回 ---
await page.locator('button[title="设置"]').click();
await page.waitForTimeout(700);
const langSelect = page.locator("select").filter({ hasText: /简体中文|English/ }).first();
await langSelect.selectOption("en-US");
await page.waitForTimeout(1000);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
const enText = await page.locator("body").innerText();
check(
  "切换到英文",
  enText.includes("Weekly stats") && (await page.evaluate(() => document.documentElement.lang)) === "en-US",
  enText.slice(0, 80),
);
await page.locator('button[title="Settings"]').click();
await page.waitForTimeout(700);
await page.locator("select").filter({ hasText: /简体中文|English/ }).first().selectOption("zh-CN");
await page.waitForTimeout(900);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
const zhText = await page.locator("body").innerText();
check("切回中文", zhText.includes("周统计") && zhText.includes("项目"), zhText.slice(0, 60));

// ===== v0.2 体验优化：A1 / A2 / A3 / A4 / A5 / P1 / P4 =====
const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const todayIdx = ((new Date().getDay() + 6) % 7) + 1;
const emptyIdx = [1, 2, 3, 4, 5, 6].find((index) => index !== todayIdx) ?? 1;
const blurAll = () => page.evaluate(() => document.activeElement?.blur?.());
const focusChart = () =>
  page.evaluate(() => document.querySelector("[data-drop-chart]")?.focus());
const pointXY = (id) =>
  page.$$eval(
    "g.chart-point",
    (els, taskId) => {
      const el = els.find((item) => item.getAttribute("data-task-id") === taskId);
      const match = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(
        el?.getAttribute("transform") ?? "",
      );
      return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
    },
    id,
  );
const dotBoxOf = (id) =>
  page.locator(`g.chart-point[data-task-id="${id}"] circle.point-dot`).boundingBox();
const toastText = () =>
  page
    .locator("div.fixed.bottom-12")
    .first()
    .innerText()
    .catch(() => "");

// A3：数字键回到「今天」的板（childA 的承诺点在这张板上）
await blurAll();
await page.keyboard.press(String(todayIdx));
await page.waitForTimeout(800);
const todayTitle = await page.locator("h1").first().innerText();
check("A3 数字键切到今天的板", todayTitle.includes(weekdays[todayIdx - 1]), todayTitle);

// --- A2：方向键改动坐标 ---
await page.mouse.move(5, 5);
await page.waitForTimeout(250);
const aDotBox = await dotBoxOf(childAId);
check("A2 前置：childA 的承诺点在图上", Boolean(aDotBox));
if (aDotBox) {
  await page.mouse.click(aDotBox.x + aDotBox.width / 2, aDotBox.y + aDotBox.height / 2);
  await page.waitForTimeout(500);
  await focusChart();
  const xy0 = await pointXY(childAId);

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(700);
  const xy1 = await pointXY(childAId);
  // 横轴 100 在左：紧迫度 +1 → 像素 x 变小
  check(
    "A2 → 提高紧迫度",
    Boolean(xy0 && xy1 && xy1.x < xy0.x),
    `${JSON.stringify(xy0)} → ${JSON.stringify(xy1)}`,
  );

  // --- A1：Ctrl+Z 撤销坐标改动 ---
  await focusChart();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  const xyUndo = await pointXY(childAId);
  check(
    "A1 Ctrl+Z 撤销回原坐标",
    Boolean(xy0 && xyUndo && xyUndo.x === xy0.x && xyUndo.y === xy0.y),
    `${JSON.stringify(xy0)} vs ${JSON.stringify(xyUndo)}`,
  );
  check("A1 撤销 toast", (await toastText()).includes("已撤销"), await toastText());

  // --- A2：↑ 提高重要度，再撤销 ---
  await focusChart();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(700);
  const xy2 = await pointXY(childAId);
  check(
    "A2 ↑ 提高重要度",
    Boolean(xy0 && xy2 && xy2.y < xy0.y),
    `${JSON.stringify(xy0)} → ${JSON.stringify(xy2)}`,
  );
  await focusChart();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  check("A1 撤销 ↑ 改动", (await pointXY(childAId))?.y === xy0?.y);

  // --- P1：面板可贴右边缘 ---
  const chartBox2 = await page.locator("[data-drop-chart]").first().boundingBox();
  const pinBtn = page.locator('div.absolute.z-30 button[title="贴右边缘"]').first();
  check("P1 面板出现「贴右边缘」按钮", (await pinBtn.count()) === 1);
  await pinBtn.click();
  await page.waitForTimeout(400);
  const panelBox = await page.locator("div.absolute.z-30").first().boundingBox();
  check(
    "P1 贴边后按钮变「取消贴边」且面板靠右",
    (await page.locator('div.absolute.z-30 button[title="取消贴边"]').count()) === 1 &&
      Boolean(panelBox && chartBox2 && panelBox.x > chartBox2.x + chartBox2.width * 0.5),
    `panelX=${panelBox?.x} chartRight=${chartBox2 ? chartBox2.x + chartBox2.width : "?"}`,
  );

  // --- A2：Delete 从图上移除 + A1 撤销恢复 ---
  await focusChart();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(800);
  check("A2 Delete 把点移出图", (await pointXY(childAId)) === null);
  await focusChart();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  check("A1 撤销 Delete 恢复点位", (await pointXY(childAId))?.x === xy0?.x);

  // --- A4：把已在图上的节点从任务树拖到图外 = 取消承诺 ---
  const gripA = page.locator(`[data-tree-row="${childAId}"] [data-tree-grip]`);
  await gripA.scrollIntoViewIfNeeded();
  const gripABox = await gripA.boundingBox();
  const viewportH = await page.evaluate(() => window.innerHeight);
  if (gripABox) {
    await page.mouse.move(gripABox.x + gripABox.width / 2, gripABox.y + gripABox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gripABox.x + 4, gripABox.y + 12, { steps: 4 });
    await page.mouse.move(140, viewportH - 14, { steps: 12 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
  check("A4 拖到图外取消承诺", (await pointXY(childAId)) === null);
  check("A4 提示已从图上移除", (await toastText()).includes("已从图上移除"), await toastText());
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  check("A1 撤销拖出图", (await pointXY(childAId)) !== null);
}

// --- A5：已完成 / 已归档抽屉 ---
await blurAll();
await page.locator(`[data-tree-row="${childAId}"] button`).first().click();
await page.waitForTimeout(1000);
await page.locator('button[title="已完成 / 已归档"]').click();
await page.waitForTimeout(600);
const drawer = page.locator("div.fixed.inset-0.z-40 aside");
const drawerText = await drawer.innerText().catch(() => "");
check(
  "A5 抽屉列出已完成 + 本周计数",
  drawerText.includes("本周完成") && drawerText.includes(childAName),
  drawerText.replace(/\n/g, " | ").slice(0, 100),
);
check(
  "A5 行内有取消完成 / 打开详情",
  drawerText.includes("取消完成") && drawerText.includes("打开详情"),
);
const doneRowsBefore = await drawer.getByRole("button", { name: "取消完成" }).count();
await drawer.getByRole("button", { name: "取消完成" }).first().click();
await page.waitForTimeout(1000);
const doneRowsAfter = await drawer.getByRole("button", { name: "取消完成" }).count();
check(
  "A5 取消完成后该行从列表消失",
  doneRowsAfter === doneRowsBefore - 1,
  `${doneRowsBefore} → ${doneRowsAfter}`,
);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
check("A5 Esc 关闭抽屉", (await page.locator("div.fixed.inset-0.z-40 aside").count()) === 0);

// --- A3 + P4：数字键切到空板，显示三步引导 ---
await blurAll();
await page.keyboard.press(String(emptyIdx));
await page.waitForTimeout(800);
const emptyTitle = await page.locator("h1").first().innerText();
check("A3 数字键切到空板", emptyTitle.includes(weekdays[emptyIdx - 1]), emptyTitle);
const emptyGuide = await page.locator("[data-drop-chart]").first().innerText();
check(
  "P4 空板显示三步引导",
  emptyGuide.includes("这张图还没有任务") &&
    emptyGuide.includes("从右侧任务树拖一个节点进来") &&
    emptyGuide.includes("落点决定象限"),
  emptyGuide.replace(/\n/g, " | ").slice(0, 120),
);
const sampleBtnCount = await page.locator('button:has-text("试试示例数据")').count();
const hasTasksNow = (await treeTitles()).length > 0;
check(
  "P4 仅空库时才给示例数据按钮",
  hasTasksNow ? sampleBtnCount === 0 : sampleBtnCount === 1,
  `hasTasks=${hasTasksNow} buttons=${sampleBtnCount}`,
);

// --- P3：每张板的筛选持久化（切板往返 + 刷新落到 settings）---
await blurAll();
const filterInput = page.locator('input[placeholder="筛选标题 / 笔记…"]').first();
const marker = `筛选${Date.now().toString().slice(-4)}`;
await page.keyboard.press("5");
await page.waitForTimeout(700);
await filterInput.fill(marker);
await page.waitForTimeout(500);
check(
  "P3 周五板可写入筛选",
  (await filterInput.inputValue()) === marker,
  await filterInput.inputValue(),
);
await blurAll();
await page.keyboard.press("3");
await page.waitForTimeout(700);
const wedVal = await filterInput.inputValue();
await blurAll();
await page.keyboard.press("5");
await page.waitForTimeout(700);
const backVal = await filterInput.inputValue();
check(
  "P3 切板往返后筛选各板独立保留",
  wedVal === "" && backVal === marker,
  `周三="${wedVal}" 周五="${backVal}"`,
);
await page.reload();
await page.waitForTimeout(1500);
await blurAll();
await page.keyboard.press("5");
await page.waitForTimeout(800);
const reloadVal = await filterInput.inputValue();
check("P3 刷新后筛选仍在（已落盘 settings）", reloadVal === marker, reloadVal);
await page.locator('button[title="清除筛选"]').first().click();
await page.waitForTimeout(400);
check("P3 清除筛选", (await filterInput.inputValue()) === "", await filterInput.inputValue());

check("无运行时报错", errors.length === 0, errors.join(" | "));

console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} 通过`);
await browser.close();
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;


