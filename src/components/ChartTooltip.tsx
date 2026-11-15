import {
  AlertTriangle,
  CalendarClock,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  MoveRight,
  Play,
  Square,
  Tag as TagIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Placement, Tag, Task } from "../data/types";
import { BOARD_LABEL, dateKey } from "../lib/board";
import { t } from "../lib/i18n";
import { QUADRANTS, quadrantOf } from "../lib/quadrant";

/** 树形视图的展开状态：跨选中、跨重开都保留 */
const TREE_EXPANDED = new Map<string, boolean>();

export type ChildViewMode = "direct" | "breadcrumb" | "tree";

interface ChartTooltipProps {
  task: Task;
  placement: Placement;
  tags: Tag[];
  path: string[];
  container: { width: number; height: number };
  pointer: { x: number; y: number };
  /** 选中态：常驻、可交互，并展示子节点状态操作 */
  interactive?: boolean;
  tasks?: Task[];
  childMode?: ChildViewMode;
  onToggleDone?: (id: string, done: boolean) => void;
  onToggleDoing?: (id: string) => void;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: "待办", color: "#60a5fa" },
  doing: { label: "进行中", color: "#fbbf24" },
  done: { label: "已完成", color: "#34d399" },
  archived: { label: "已归档", color: "#64748b" },
};

function buildByParent(tasks: Task[]) {
  const byParent = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.status === "archived") continue;
    const key = task.parentId ?? "";
    const list = byParent.get(key) ?? [];
    list.push(task);
    byParent.set(key, list);
  }
  return byParent;
}

function collectExpanded(
  rootId: string,
  byParent: Map<string, Task[]>,
  _tick: number,
): Array<{ task: Task; depth: number }> {
  const rows: Array<{ task: Task; depth: number }> = [];
  const walk = (id: string, depth: number) => {
    for (const child of byParent.get(id) ?? []) {
      rows.push({ task: child, depth });
      // 默认折叠：只有明确展开过的才往下走
      if (TREE_EXPANDED.get(child.id)) walk(child.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return rows;
}

export function ChartTooltip({
  task,
  placement,
  tags,
  path,
  container,
  pointer,
  interactive = false,
  tasks = [],
  childMode = "direct",
  onToggleDone,
  onToggleDoing,
}: ChartTooltipProps) {
  const quadrant = QUADRANTS[quadrantOf(placement.x, placement.y)];
  const status = STATUS_META[task.status] ?? STATUS_META.todo;
  const today = dateKey(new Date());
  const overdue = Boolean(task.effectiveDue && task.effectiveDue < today);
  const dueIn = task.effectiveDue ? daysBetween(today, task.effectiveDue) : null;

  const byParent = useMemo(() => buildByParent(tasks), [tasks]);
  const [focusId, setFocusId] = useState(task.id);
  const [expandTick, setExpandTick] = useState(0);

  useEffect(() => {
    setFocusId(task.id);
  }, [task.id]);

  // 面包屑：从选中节点到当前下钻节点
  const chain = (() => {
    if (!interactive) return [] as Task[];
    const steps: Task[] = [];
    let cursor: Task | undefined = tasks.find((item) => item.id === focusId) ?? task;
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      steps.unshift(cursor);
      if (cursor.id === task.id) break;
      cursor = cursor.parentId ? tasks.find((item) => item.id === cursor?.parentId) : undefined;
    }
    return steps;
  })();

  const toggleExpand = (id: string) => {
    TREE_EXPANDED.set(id, !TREE_EXPANDED.get(id));
    setExpandTick((tick) => tick + 1);
  };

  const childRows = (() => {
    if (!interactive) return [];
    if (childMode === "tree") return collectExpanded(task.id, byParent, expandTick).slice(0, 60);
    const owner = childMode === "breadcrumb" ? (tasks.find((t) => t.id === focusId) ?? task) : task;
    return (byParent.get(owner.id) ?? []).map((item) => ({ task: item, depth: 0 }));
  })();

  const offsetX = pointer.x > container.width - 280 ? -272 : 18;
  const offsetY = pointer.y > container.height - 260 ? -220 : 14;

  const dueText = (() => {
    if (!task.effectiveDue) return t("无截止日");
    if (overdue)
      return t("逾期 {n} 天（{date}）", { n: Math.abs(dueIn ?? 0), date: task.effectiveDue });
    if (dueIn === 0) return t("今天到期（{date}）", { date: task.effectiveDue });
    return t("还有 {n} 天（{date}）", { n: dueIn ?? 0, date: task.effectiveDue });
  })();

  const momentumText =
    placement.momentumMode === "auto"
      ? t("自动 · {v}/天", { v: placement.vx.toFixed(2) })
      : t("手动 · {v}/天", { v: placement.vx.toFixed(2) });

  const daysToEdge =
    placement.vx > 0 ? Math.max(0, Math.round((placement.x - 50) / placement.vx)) : null;

  return (
    <div
      className={[
        "absolute z-30 w-[264px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--tip-bg)] shadow-2xl backdrop-blur-sm",
        interactive ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      style={{ left: pointer.x + offsetX, top: pointer.y + offsetY }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-[var(--line-soft)] px-3 py-2">
        <div className="flex items-start gap-1.5">
          <span className="mt-px shrink-0 text-[12px] leading-none">{task.emoji ?? ""}</span>
          <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-[var(--t1)]">
            {task.title}
          </span>
        </div>
        {path.length > 1 ? (
          <div className="mt-1 truncate pl-[18px] text-[9px] text-[var(--t3)]">
            {path.slice(0, -1).join(" › ")}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 px-3 py-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded px-1 py-px text-[9px]"
            style={{ backgroundColor: `${status.color}1f`, color: status.color }}
          >
            {status.label}
          </span>
          <span
            className="rounded px-1 py-px text-[9px]"
            style={{
              backgroundColor: `color-mix(in srgb, ${quadrant.color} 12%, transparent)`,
              color: quadrant.color,
            }}
          >
            {quadrant.short} · {t(quadrant.label)}
          </span>
          <span className="ml-auto text-[var(--t3)]">{t(quadrant.description)}</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--t3)]">
          <span className="text-[var(--t3)]">{t("紧迫")}</span>
          <span className="font-mono text-[var(--t1)]">{Math.round(placement.x)}</span>
          <span className="text-[var(--t5)]">·</span>
          <span className="text-[var(--t3)]">{t("重要")}</span>
          <span className="font-mono text-[var(--t1)]">{Math.round(placement.y)}</span>
          <span className="ml-auto text-[9px] text-[var(--t4)]">
            {placement.board === "week" ? t("周级") : BOARD_LABEL[placement.board]}
          </span>
        </div>

        <div className="flex items-start gap-1.5">
          <CalendarClock
            size={11}
            className={overdue ? "mt-px shrink-0 text-red-300" : "mt-px shrink-0 text-[var(--t3)]"}
          />
          <span className={overdue ? "text-red-300" : "text-[var(--t3)]"}>{dueText}</span>
        </div>

        {task.dueSource && task.dueSource !== "own" ? (
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={11} className="mt-px shrink-0 text-[var(--t4)]" />
            <span className="text-[var(--t4)]">
              {t("截止日继承自「{title}」", { title: task.dueSource })}
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          <MoveRight size={11} className="shrink-0 text-[var(--t3)]" />
          <span className="text-[var(--t3)]">{momentumText}</span>
          {daysToEdge !== null && placement.momentumMode === "auto" ? (
            <span className="ml-auto text-[9px] text-[var(--t4)]">
              {daysToEdge > 0 ? t("{n} 天后进 Q1", { n: daysToEdge }) : t("已在 Q1")}
            </span>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <TagIcon size={10} className="text-[var(--t4)]" />
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 rounded border border-[var(--line)] px-1 py-px text-[9px] text-[var(--t3)]"
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                />
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {interactive && (childRows.length > 0 || chain.length > 1) ? (
          <div className="mt-1 border-t border-[var(--line-soft)] pt-1.5">
            {chain.length > 1 || childMode === "breadcrumb" ? (
              <div className="mb-1 flex flex-wrap items-center gap-0.5 text-[9px] text-[var(--t3)]">
                {(chain.length > 0 ? chain : [task]).map((node) => (
                  <span key={node.id} className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setFocusId(node.id)}
                      className={[
                        "rounded px-0.5 hover:bg-[var(--hover-strong)]",
                        node.id === focusId ? "text-[var(--t1)]" : "hover:text-[var(--t2)]",
                      ].join(" ")}
                    >
                      {node.title}
                    </button>
                    {node.id !== (chain.at(-1)?.id ?? task.id) ? (
                      <span className="text-[var(--t5)]">›</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mb-1 flex items-center justify-between text-[9px] text-[var(--t3)]">
              <span>
                {t("子任务 {n}", { n: childRows.length })}
                {childMode === "tree" ? t("（整棵）") : ""}
              </span>
              <span className="text-[var(--t4)]">
                {t("{n} 完成", { n: childRows.filter((row) => row.task.status === "done").length })}
              </span>
            </div>
            <div className="max-h-[168px] space-y-0.5 overflow-y-auto pr-1">
              {childRows.map(({ task: child, depth }) => {
                const hasKids = (byParent.get(child.id) ?? []).length > 0;
                const expanded = Boolean(TREE_EXPANDED.get(child.id));
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-[var(--hover)]"
                    style={{ paddingLeft: depth * 12 + 2 }}
                  >
                    {hasKids ? (
                      <button
                        type="button"
                        onClick={() =>
                          childMode === "tree" ? toggleExpand(child.id) : setFocusId(child.id)
                        }
                        className="flex h-4 w-3 shrink-0 items-center justify-center text-[var(--t3)] hover:text-[var(--t1)]"
                        title={childMode === "tree" ? t("展开 / 收起") : t("进入下一层")}
                        aria-label={childMode === "tree" ? t("展开") : t("进入下一层")}
                      >
                        {childMode === "tree" && expanded ? (
                          <ChevronDown size={10} />
                        ) : (
                          <ChevronRight size={10} />
                        )}
                      </button>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleDone?.(child.id, child.status !== "done")}
                      className="flex h-4 w-4 shrink-0 items-center justify-center"
                      title={child.status === "done" ? t("取消完成") : t("完成")}
                    >
                      {child.status === "done" ? (
                        <CheckSquare2 size={12} className="text-accent-400" />
                      ) : (
                        <Square size={12} className="text-[var(--t4)]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (childMode !== "tree" && hasKids) setFocusId(child.id);
                      }}
                      className={[
                        "min-w-0 flex-1 truncate text-left text-[10px]",
                        child.status === "done"
                          ? "text-[var(--t3)] line-through"
                          : "text-[var(--t2)]",
                        hasKids && childMode !== "tree" ? "hover:text-accent-200" : "",
                      ].join(" ")}
                      title={child.title}
                    >
                      {child.emoji ? `${child.emoji} ` : ""}
                      {child.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleDoing?.(child.id)}
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                        child.status === "doing"
                          ? "text-amber-300"
                          : "text-[var(--t4)] hover:text-[var(--t2)]",
                      ].join(" ")}
                      title={child.status === "doing" ? t("暂停处理") : t("开始处理")}
                    >
                      <Play size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-0.5 text-[9px] text-[var(--t4)]">
          <span>{task.noteJson ? t("有说明") : t("无说明")}</span>
          <span className="text-[var(--t5)]">|</span>
          <span>{interactive ? t("右键可改状态") : t("双击打开详情")}</span>
        </div>
      </div>
    </div>
  );
}
