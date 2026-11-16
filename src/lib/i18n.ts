/**
 * 极简 i18n：
 * - 以中文原文作为 key（gettext 风格），中文界面零成本，英文只维护一张映射
 * - 用 `{name}` 做插值
 * - 当前语言放在模块变量里，`setLocale` 由 App 在渲染前调用
 */

import { JA } from "./locales/ja";
import { toTraditional } from "./locales/zh-tw";

export type Locale = "zh-CN" | "zh-TW" | "en-US" | "ja-JP";

export const LOCALES: Array<{ id: Locale; label: string }> = [
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "en-US", label: "English" },
  { id: "ja-JP", label: "日本語" },
];

const EN: Record<string, string> = {
  // 通用
  关闭: "Close",
  取消: "Cancel",
  保存: "Save",
  创建: "Create",
  删除: "Delete",
  清除: "Clear",
  完成: "Done",
  详情: "Details",
  设置: "Settings",
  备份: "Backup",
  全选: "Select all",
  展开: "Expand",
  折叠: "Collapse",
  未来: "Future",
  过去: "Past",
  今天: "Today",
  明天: "Tomorrow",
  昨天: "Yesterday",
  无: "None",

  // 顶栏
  "local-first · 承诺图": "local-first · commitment chart",
  项目: "Project",
  周统计: "Weekly stats",
  切换到浅色: "Switch to light",
  切换到深色: "Switch to dark",
  "SQLite · WAL · 本地": "SQLite · WAL · local",
  "拖动树节点到左侧图 = 承诺": "Drag a tree node onto the chart = commit",
  "正在加载本地数据…": "Loading local data…",

  // 周条
  周: "Week",
  全景: "Overview",
  "拖到这里 = 承诺到周图": "Drop here to commit to the week board",
  "拖到这里 = 承诺到{day}": "Drop here to commit to {day}",
  "{day} 已过去，不能投放（会顺延到今天）": "{day} has passed — drops roll over to today",
  "{board} · 不翻周": "{board} · this week only",

  // 象限
  "Q1 立即": "Q1 Do now",
  "Q2 安排": "Q2 Schedule",
  "Q3 限时": "Q3 Limit",
  "Q4 删/归档": "Q4 Drop",
  重要且紧急: "Important & urgent",
  重要不紧急: "Important, not urgent",
  紧急不重要: "Urgent, not important",
  不重要不紧急: "Neither",
  立即处理: "Do it now",
  安排时间: "Schedule it",
  委托限时: "Delegate / timebox",
  删除归档: "Drop it",
  紧迫: "Urgency",
  重要: "Importance",

  // 树
  待办: "To do",
  进行中: "Doing",
  已完成: "Done",
  已归档: "Archived",
  快捷键: "Shortcuts",
  "点行内文字直接改 · Enter 新建 · 拖把手到图上承诺":
    "Click text to edit · Enter to add · drag the handle onto the chart",
  新建项目: "New project",
  项目名称: "Project name",
  "例如：TaskBoard 开发": "e.g. TaskBoard",
  颜色: "Color",
  "图标（可选）": "Icon (optional)",
  "🚀 或任意 emoji": "🚀 or any emoji",
  "在下方新建同级（顶层则新建子任务）": "Add sibling (child for a top-level project)",
  "在当前节点之后插入（顶层项目则新建子任务）":
    "Insert after this node (child for a top-level project)",
  重命名: "Rename",
  "Tab / Shift+Tab": "Tab / Shift+Tab",
  "缩进 / 反缩进": "Indent / outdent",
  同级上下移动: "Move among siblings",
  切换行: "Move between rows",
  "折叠 / 展开": "Collapse / expand",
  拖动把手: "Drag handle",
  "放到图上 = 承诺；放到行上 = 排序/换父级":
    "Onto the chart = commit; onto a row = reorder / re-parent",
  "拖动：放到图上=承诺；放到行上=排序/换父级":
    "Drag: onto the chart = commit; onto a row = reorder",
  "完成（级联子任务）": "Complete (cascades to children)",
  "取消完成（含子任务）": "Uncomplete (with children)",
  撤销完成: "Uncomplete",
  开始处理: "Start",
  暂停处理: "Pause",
  继承自父级: "Inherited from parent",
  自定义图标: "Custom icon",
  还有: "and",
  个子任务: "subtasks",

  // 筛选
  搜索: "Search",
  全部状态: "All statuses",
  全部: "All",
  无标签: "No tags",
  今天到期: "Due today",
  本周到期: "Due this week",
  已逾期: "Overdue",
  清除筛选: "Clear filters",

  // tooltip / 面板
  无说明: "No notes",
  有说明: "Has notes",
  双击打开详情: "Double-click for details",
  右键可改状态: "Right-click to change status",
  无截止日: "No due date",
  "今天到期（{date}）": "Due today ({date})",
  "还有 {n} 天（{date}）": "in {n} days ({date})",
  "逾期 {n} 天（{date}）": "overdue by {n} days ({date})",
  "截止日继承自「{title}」": 'Due date inherited from "{title}"',
  自己的截止日: "Own due date",
  "子任务 {n}": "Subtasks {n}",
  "{n} 完成": "{n} done",
  "（整棵）": " (full tree)",
  进入下一层: "Go deeper",
  周级: "Week-level",
  "已在 Q1": "already in Q1",
  "{n} 天后进 Q1": "enters Q1 in {n} days",
  "手动 · {v}/天": "Manual · {v}/day",
  "自动 · {v}/天": "Auto · {v}/day",

  // 图
  "已隐藏 {n}": "Hidden {n}",
  "{n} 个承诺": "{n} commitments",
  "{n} 承诺": "{n} commitments",
  "松开：按落点放上去": "Release to place here",
  "拖到{board}图上松开": "Drop onto the {board} chart",
  "这是空的——把右侧任务拖进来": "Empty — drag a task from the right",
  这个板还没有承诺: "No commitments yet on this board",

  // 详情
  任务详情: "Task details",
  属性: "Attributes",
  说明: "Notes",
  标签: "Tags",
  截止: "Due",
  状态: "Status",
  添加说明: "Add notes",
  还没写说明: "No notes yet",
  删除任务: "Delete task",
  "删除「{title}」及其子任务？": 'Delete "{title}" and its subtasks?',

  // 动量
  "动量 / 截止日期": "Momentum / due date",
  截止日期: "Due date",
  动量模式: "Momentum mode",
  自动: "Auto",
  手动: "Manual",
  "只影响动量和逾期筛选；不影响是否上图。留空表示无截止日。":
    "Only affects momentum and overdue filters; not whether it is on the chart.",
  "每天推进（点/天）": "Advance per day (points/day)",
  速度: "Speed",
  "+1 天": "+1 day",
  "+3 天": "+3 days",
  "+7 天": "+7 days",

  // 设置
  通用: "General",
  界面语言: "Language",
  标签组: "Tag groups",
  新建标签组: "New tag group",
  单选: "Single",
  多选: "Multiple",
  自由填: "Free text",
  默认动量: "Default momentum",
  着色依据: "Color by",
  按项目: "By project",
  按标签组: "By tag group",
  立即备份: "Back up now",
  数据目录: "Data folder",
  备份目录: "Backup folder",
  图上显示: "On chart",
  "显示动量（线段、刻度、虚影、逾期尾巴）": "Show momentum (line, ticks, ghost, overdue tail)",
  预测天数: "Forecast days",
  选中面板的子节点: "Selected panel children",
  直接子节点: "Direct children",
  "面包屑 + 列表": "Breadcrumb + list",
  整棵子树: "Full subtree",
  天: "days",

  // 周统计
  本周完成: "Completed this week",
  "完成 {n}": "Done {n}",
  "逾期 {n}": "Overdue {n}",
  还没有完成记录: "No completions yet",

  // emoji
  选择图标: "Choose an icon",
  "每个节点都能单独设置；不设就继承父级":
    "Each node can have its own icon; unset inherits from the parent",
  清除图标: "Clear icon",
  "当前：{emoji}": "Current: {emoji}",
  "也可以直接粘贴一个 emoji 后回车": "Or paste an emoji and press Enter",
  使用: "Use",
  "筛选分类（常用 / 工作 / 生活 / 符号）": "Filter categories",
  常用: "Common",
  工作: "Work",
  生活: "Life",
  符号: "Symbols",
  // ---- 补全 ----
  "{board}承诺图": "{board} board",
  "{n} 天": "{n} days",
  "{start} → {end} · 完成 {done} · 逾期 {overdue}":
    "{start} → {end} · done {done} · overdue {overdue}",
  "x 速度（点/天）": "x speed (points/day)",
  "y 速度（点/天）": "y speed (points/day)",
  "按 Enter 新建子任务。": "Press Enter to add a subtask.",
  "按标签组：{name}": "By tag group: {name}",
  "保存中…": "Saving…",
  "本周 {n}": "This week {n}",
  本周还没有完成的任务: "Nothing completed this week",
  "标签：全部": "Tags: all",
  "标签组、动量默认、颜色、备份": "Tag groups, momentum, colors, backup",
  从图上移除: "Remove from chart",
  "单选 / 多选 / 自由输入": "Single / multiple / free input",
  "点上方「项目」创建第一个。": 'Use "Project" above to create the first one.',
  "点颜色按项目或某个标签组。": "Dot colors follow the project or a tag group.",
  "顶层节点就是项目，也是根任务": "Top-level nodes are projects and roots",
  父任务: "parent",
  "还没有标签组，去设置里添加。": "No tag groups yet — add them in settings.",
  "还没有项目。": "No projects yet.",
  或直接新建一个项目: "or create a project directly",
  "记录上下文、下一步、链接… 输入 `[] ` 创建待办":
    "Context, next step, links… type `[] ` for a task list",
  "继承自 {title}": "inherited from {title}",
  "继承自「{title}」": 'inherited from "{title}"',
  "加载中…": "Loading…",
  "截止：本周": "Due: this week",
  "截止：今天": "Due: today",
  "截止：全部": "Due: all",
  "截止：无": "Due: none",
  "截止：逾期": "Due: overdue",
  "今日到期 {n}": "Due today {n}",
  可留空: "optional",
  "可直接编辑 · 拖到图上承诺": "Edit inline · drag onto the chart to commit",
  没有逾期任务: "No overdue tasks",
  切换后立即生效: "applies immediately",
  取消完成: "Uncomplete",
  任务树: "Task tree",
  "日板聚合 + 周级承诺": "Day boards aggregated + week-level commitments",
  筛选: "Filter",
  "筛选 {n}": "Filter {n}",
  "筛选标题 / 笔记…": "Filter title / notes…",
  "删除「{title}」及其 {n} 个子任务？": 'Delete "{title}" and its {n} subtasks?',
  删除标签: "Delete tag",
  删除标签组: "Delete tag group",
  "删除标签组「{name}」及其标签？": 'Delete tag group "{name}" and its tags?',
  "删除这个任务及其所有子任务？": "Delete this task and all its subtasks?",
  设置图标: "Set icon",
  "数据目录：{dir}": "Data folder: {dir}",
  数据与备份: "Data & backup",
  "松开：放到这张图": "Release to place on this chart",
  添加: "Add",
  拖到日期的标签或图上: "Drag onto a day tab or the chart",
  "拖点调整 · 右键动量": "Drag points · right-click for momentum",
  "拖拽 / 右键 / 双击": "drag / right-click / double-click",
  "完成 / 取消完成": "Complete / uncomplete",
  "完成（含子任务）": "Complete (with subtasks)",
  "完成倒序 / 逾期按截止日正序": "Newest first / overdue by due date",
  未设置属性: "No attributes",
  "无截止日任务的默认 x 速度（点/天）。":
    "Default x speed for tasks without a due date (points/day).",
  新标签组名称: "New tag group name",
  新建子任务: "New subtask",
  新任务: "New task",
  新项目: "New project",
  "新增标签…": "New tag…",
  "已隐藏 {n} 个": "Hidden: {n}",
  逾期: "Overdue",
  "逾期 {date}": "Overdue {date}",
  在树中编辑: "Edit in tree",
  "在树中查找…": "Search the tree…",
  暂无标签: "No tags",
  "展开 / 收起": "Expand / collapse",
  "这个节点还没有子任务。": "This node has no subtasks yet.",
  周图: "Week board",
  "自动（按截止日）": "Auto (by due date)",
  "自然周：周一 → 周日": "Natural week: Mon → Sun",
  周一: "Mon",
  周二: "Tue",
  周三: "Wed",
  周四: "Thu",
  周五: "Fri",
  周六: "Sat",
  周日: "Sun",
  "Q1 · 重要且紧急": "Q1 · Important & urgent",
  "Q2 · 重要不紧急": "Q2 · Important, not urgent",
  "Q3 · 紧急不重要": "Q3 · Urgent, not important",
  "Q4 · 不重要不紧急": "Q4 · Neither",
  "← 越靠左越紧迫": "← more urgent to the left",
  "重要性 ↑": "Importance ↑",
  这张图还没有任务: "No tasks on this chart yet",
  从右侧任务树拖一个节点进来: "Drag a node from the tree on the right",
  重要性紧迫性四象限任务图: "Eisenhower matrix: urgency × importance",
  " · 截止 {date}": " · due {date}",
  "紧迫 {x} / 重要 {y}": "urgency {x} / importance {y}",
  "逾期 {n}d": "overdue {n}d",
  ERR_EMPTY_TITLE: "Title cannot be empty",
  ERR_PARENT_NOT_FOUND: "Parent task not found",
  ERR_AFTER_NOT_FOUND: "Insert position not found",
  ERR_TASK_NOT_FOUND_AFTER_CREATE: "Task not found after creation",
  ERR_TASK_NOT_FOUND_AFTER_UPDATE: "Task not found after update",
  ERR_TASK_NOT_FOUND: "Task not found",
  ERR_INVALID_STATUS: "Invalid status",
  ERR_SELF_PARENT: "A task cannot be its own parent",
  ERR_INVALID_BOARD: "Invalid board",
  ERR_DAY_BOARD_NEEDS_DATE: "Day boards require a date",
  ERR_INVALID_DATE: "Date must be YYYY-MM-DD",
  ERR_PLACEMENT_NOT_FOUND_AFTER_SAVE: "Placement not found after save",
  ERR_PLACEMENT_NOT_FOUND_AFTER_UPDATE: "Placement not found after update",
  ERR_INVALID_MOMENTUM_MODE: "Invalid momentum mode",
  ERR_NOT_PLACED: "This task is not on the chart",
  ERR_INVALID_TAG_GROUP_MODE: "Tag group mode must be single or multi",
  新建组: "New group",
  自由: "Free",
  自由输入: "Free input",

  // ---- 撤销 / 回收站 / 备份 / 空态（v0.2） ----
  "已撤销：{label}": "Undone: {label}",
  "已重做：{label}": "Redone: {label}",
  未命名: "Untitled",
  "新建「{title}」": 'Create "{title}"',
  "修改「{title}」": 'Edit "{title}"',
  "完成「{title}」": 'Complete "{title}"',
  "取消完成「{title}」": 'Uncomplete "{title}"',
  "删除「{title}」": 'Delete "{title}"',
  "修改标签「{title}」": 'Change tags of "{title}"',
  "放到图上「{title}」": 'Place "{title}" on the chart',
  "移动「{title}」": 'Move "{title}"',
  "从图上移除「{title}」": 'Remove "{title}" from the chart',
  "改动量「{title}」": 'Change momentum of "{title}"',
  "已从图上移除，Ctrl+Z 撤销": "Removed from chart — Ctrl+Z to undo",
  "已完成 / 已归档": "Done / Archived",
  "本周完成 {n} / 共 {m}": "{n} done this week / {m} total",
  还没有完成的任务: "Nothing completed yet",
  还没有归档的任务: "Nothing archived yet",
  打开详情: "Open details",
  取消贴边: "Unpin",
  贴右边缘: "Pin to right edge",
  "① 从右侧任务树拖一个节点进来": "① Drag a node in from the tree on the right",
  "② 落点决定象限：越靠左上越重要且紧急":
    "② Where it lands sets the quadrant — up & left is important and urgent",
  "③ 在点上右键可以改动量与截止日": "③ Right-click a point to change momentum and due date",
  试试示例数据: "Try sample data",
  清除示例数据: "Clear sample data",
  "示例：设计数据模型": "Sample: design the data model",
  "示例：写周报": "Sample: write the weekly report",
  "示例：回复邮件": "Sample: reply to emails",
  最近备份: "Recent backups",
  "保留最近 14 份": "Keeps the latest 14",
  还没有备份: "No backups yet",
  恢复: "Restore",
  "恢复这份备份？当前数据会先另存为 data.db.before-restore。":
    "Restore this backup? Current data is saved as data.db.before-restore first.",
  "已从备份恢复，需要重启应用。": "Restored from backup — the app needs a restart.",
  立即重启: "Restart now",
};

const ZH_OVERRIDE: Record<string, string> = {};

let current: Locale = "zh-CN";

export function setLocale(locale: Locale) {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  );
}

/** 以中文原文为 key 取当前语言的文案 */
export function t(message: string, params?: Record<string, string | number>): string {
  if (current === "zh-CN") {
    const zh = ZH_OVERRIDE[message];
    return interpolate(zh ?? message, params);
  }
  if (current === "zh-TW") return interpolate(toTraditional(message), params);
  if (current === "ja-JP") return interpolate(JA[message] ?? EN[message] ?? message, params);
  return interpolate(EN[message] ?? message, params);
}

/** 后端错误码 → 当前语言文案；未收录的原样返回 */
export function translateError(message: string): string {
  return t(message);
}

function normalizeLocale(value: string | undefined): Locale {
  return LOCALES.some((item) => item.id === value) ? (value as Locale) : "zh-CN";
}

/** 语言切换后 React 需要重渲染：把 locale 放进 store 的 settings 里即可 */
export function localeFromSettings(settings: Record<string, string> | undefined): Locale {
  return normalizeLocale(settings?.locale);
}
