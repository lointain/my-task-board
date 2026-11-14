import {
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Square,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Task } from "../data/types";
import {
  buildChildren,
  colorForTask,
  dateKey,
  dueLabel,
  isOverdue,
  placementBoardLabel,
  shortTitle,
  startOfWeek,
} from "../lib/board";
import { beginTaskDrag, justDragged } from "../lib/drag";
import { useAppStore } from "../store/useAppStore";

interface TaskTreeProps {
  onOpenDetail: (id: string) => void;
  onContextMenu: (task: Task, x: number, y: number) => void;
  onNewProject: () => void;
}

export function TaskTree({ onOpenDetail, onContextMenu, onNewProject }: TaskTreeProps) {
  const data = useAppStore((state) => state.data);
  const stats = useAppStore((state) => state.stats);
  const selectedId = useAppStore((state) => state.selectedId);
  const select = useAppStore((state) => state.select);
  const completeTask = useAppStore((state) => state.completeTask);
  const [query, setQuery] = useState("");
  const [dueFilter, setDueFilter] = useState<"today" | "week" | "overdue" | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const todayRef = useRef(dateKey(new Date()));

  const tasks = data?.tasks ?? [];
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const children = useMemo(() => buildChildren(tasks), [tasks]);
  const placements = data?.placements ?? [];
  const placementMap = useMemo(
    () => new Map(placements.map((placement) => [placement.taskId, placement])),
    [placements],
  );
  const tagIds = useAppStore((state) => state.taskTags);

  const visible = useMemo(() => {
    if (!query.trim() && !dueFilter) return null;
    const q = query.trim().toLowerCase();
    const matched = new Set<string>();
    for (const task of tasks) {
      if (
        q &&
        !task.title.toLowerCase().includes(q) &&
        !(task.noteText ?? "").toLowerCase().includes(q)
      ) {
        continue;
      }
      if (dueFilter === "today" && task.effectiveDue !== todayRef.current) continue;
      if (dueFilter === "week") {
        if (!task.effectiveDue) continue;
        const start = startOfWeek();
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (task.effectiveDue < dateKey(start) || task.effectiveDue > dateKey(end)) continue;
      }
      if (dueFilter === "overdue" && !isOverdue(task, todayRef.current)) continue;
      matched.add(task.id);
      let parent = task.parentId;
      while (parent) {
        matched.add(parent);
        parent = taskMap.get(parent)?.parentId ?? null;
      }
    }
    return matched;
  }, [query, dueFilter, tasks, taskMap]);

  const roots = children.get(null) ?? [];

  const renderNode = (task: Task, depth: number): React.ReactNode => {
    if (visible && !visible.has(task.id)) return null;
    const kids = children.get(task.id) ?? [];
    const isCollapsed = collapsed.has(task.id);
    const done = task.status === "done";
    const allDone = kids.length > 0 && kids.every((kid) => kid.status === "done");
    const someDone = kids.some((kid) => kid.status === "done");
    const checked = done || (kids.length > 0 && allDone);
    const placement = placementMap.get(task.id);
    const tagList = (tagIds[task.id] ?? [])
      .map((id) => data?.tags.find((tag) => tag.id === id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
    const color = colorForTask(
      task,
      taskMap,
      tagIds[task.id] ?? [],
      data?.tags ?? [],
      data?.settings ?? {},
    );

    return (
      <div key={task.id}>
        <div
          className={[
            "group flex min-h-8 cursor-grab items-center gap-1 rounded-md pr-1 text-xs active:cursor-grabbing",
            selectedId === task.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
          ].join(" ")}
          style={{ paddingLeft: depth * 14 + 4 }}
          data-task-row={task.id}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if ((event.target as HTMLElement).closest("button")) return;
            beginTaskDrag(task.id, task.title, event.clientX, event.clientY);
          }}
          onClick={() => {
            if (justDragged()) return;
            select(task.id);
          }}
          onDoubleClick={() => {
            if (justDragged()) return;
            onOpenDetail(task.id);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onContextMenu(task, event.clientX, event.clientY);
          }}
        >
          <button
            type="button"
            className="flex h-5 w-4 items-center justify-center text-slate-600 hover:text-slate-300"
            onClick={(event) => {
              event.stopPropagation();
              if (kids.length === 0) return;
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(task.id)) next.delete(task.id);
                else next.add(task.id);
                return next;
              });
            }}
          >
            {kids.length > 0 ? (
              isCollapsed ? (
                <ChevronRight size={12} />
              ) : (
                <ChevronDown size={12} />
              )
            ) : (
              <GripVertical size={11} className="opacity-0 group-hover:opacity-100" />
            )}
          </button>

          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              void completeTask(task.id, !checked);
            }}
            title={checked ? "取消完成" : "完成（级联子任务）"}
          >
            {checked ? (
              <CheckSquare2 size={14} className="text-emerald-400" />
            ) : (
              <Square size={14} className={someDone ? "text-amber-400" : "text-slate-600"} />
            )}
          </button>

          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span
            className={[
              "min-w-0 flex-1 truncate",
              done ? "text-slate-500 line-through" : "text-slate-300",
            ].join(" ")}
            title={task.title}
          >
            {shortTitle(task.title, 22)}
          </span>

          {placement ? (
            <span className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1 text-[9px] text-emerald-300">
              {placementBoardLabel(placement)}
            </span>
          ) : null}

          {tagList.length > 0 ? (
            <span
              className="hidden shrink-0 items-center gap-1 md:flex"
              title={tagList.map((tag) => tag.name).join(" / ")}
            >
              {tagList.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                />
              ))}
            </span>
          ) : null}

          {task.effectiveDue ? (
            <span
              className={[
                "shrink-0 rounded px-1 text-[9px]",
                isOverdue(task, todayRef.current)
                  ? "bg-red-400/10 text-red-300"
                  : task.effectiveDue === todayRef.current
                    ? "bg-amber-400/10 text-amber-300"
                    : "text-slate-500",
              ].join(" ")}
              title={
                task.dueSource === "own" ? "自己的截止日" : `继承自 ${task.dueSource ?? "父任务"}`
              }
            >
              {dueLabel(task)}
            </span>
          ) : null}

          {kids.length > 0 ? (
            <span className="shrink-0 text-[9px] text-slate-600">
              {kids.filter((kid) => kid.status === "done").length}/{kids.length}
            </span>
          ) : null}

          <button
            type="button"
            className="hidden h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-white/10 hover:text-slate-200 group-hover:flex"
            onClick={(event) => {
              event.stopPropagation();
              onContextMenu(task, event.clientX, event.clientY);
            }}
            title="更多"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>

        {!isCollapsed ? kids.map((kid) => renderNode(kid, depth + 1)) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2.5">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            任务树
          </div>
          <div className="mt-0.5 text-[10px] text-slate-600">浏览为主 · 拖到图上承诺</div>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="flex h-7 items-center gap-1 rounded-lg bg-emerald-400 px-2 text-[11px] font-medium text-emerald-950 hover:bg-emerald-300"
        >
          <Plus size={12} /> 项目
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line-soft)] px-3 py-2">
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "today" ? null : "today")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "today"
              ? "bg-amber-400/15 text-amber-200"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          今日到期 {stats?.dueToday ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "week" ? null : "week")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "week"
              ? "bg-sky-400/15 text-sky-200"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          本周 {stats?.dueWeek ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "overdue" ? null : "overdue")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "overdue"
              ? "bg-red-400/15 text-red-200"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          逾期 {stats?.overdueCount ?? 0}
        </button>
        {dueFilter ? (
          <button
            type="button"
            onClick={() => setDueFilter(null)}
            className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
          >
            清除
          </button>
        ) : null}
      </div>

      <div className="border-b border-[var(--line-soft)] px-3 py-2">
        <label className="flex h-7 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-slate-500 focus-within:border-emerald-400/40">
          <Search size={12} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="在树中查找…"
            className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {roots.length === 0 ? (
          <div className="px-4 py-10 text-center text-[11px] leading-relaxed text-slate-500">
            还没有项目。
            <br />
            点右上角「项目」创建第一个。
          </div>
        ) : (
          roots.map((task) => renderNode(task, 0))
        )}
      </div>

      <div className="border-t border-[var(--line-soft)] px-3 py-2 text-[10px] text-slate-600">
        双击任务 = 详情 · 拖到图上 = 承诺 · 右键 = 拆解/新建
      </div>
    </div>
  );
}
