import {
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Placement, Task } from "../data/types";
import {
  buildChildren,
  colorForTask,
  dateKey,
  dueLabel,
  isOverdue,
  placementBoardLabel,
  shortTitle,
} from "../lib/board";
import { beginTaskDrag, justDragged } from "../lib/drag";
import { matchesTreeFilter } from "../lib/filter";
import { useAppStore } from "../store/useAppStore";

interface TreeEditorProps {
  /** null = 整片森林；否则只显示该节点为根的子树 */
  scopeId: string | null;
  /** chart：拖到图 = 承诺；reorder：行内拖动排序/改父级 */
  dragMode: "chart" | "reorder";
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onContextMenu?: (task: Task, x: number, y: number) => void;
  compact?: boolean;
  query?: string;
  dueFilter?: "today" | "week" | "overdue" | null;
}

type DropPos = "before" | "after" | "child";

interface Row {
  task: Task;
  depth: number;
  childCount: number;
}

export function TreeEditor({
  scopeId,
  dragMode,
  selectedId,
  onSelect,
  onOpenDetail,
  onContextMenu,
  compact,
  query = "",
  dueFilter = null,
}: TreeEditorProps) {
  const data = useAppStore((state) => state.data);
  const taskTags = useAppStore((state) => state.taskTags);
  const createTask = useAppStore((state) => state.createTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const completeTask = useAppStore((state) => state.completeTask);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: DropPos } | null>(null);

  const tasks = data?.tasks ?? [];
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const children = useMemo(() => buildChildren(tasks), [tasks]);
  const placementMap = useMemo(
    () => new Map((data?.placements ?? []).map((p: Placement) => [p.taskId, p])),
    [data?.placements],
  );
  const today = dateKey(new Date());

  const rows = useMemo<Row[]>(() => {
    const filtering = Boolean(query.trim()) || Boolean(dueFilter);
    const visible = new Set<string>();
    if (filtering) {
      for (const task of tasks) {
        if (!matchesTreeFilter(task, query, dueFilter)) continue;
        visible.add(task.id);
        let parent = task.parentId;
        while (parent) {
          visible.add(parent);
          parent = taskMap.get(parent)?.parentId ?? null;
        }
      }
    }

    const list: Row[] = [];
    const walk = (task: Task, depth: number) => {
      if (filtering && !visible.has(task.id)) return;
      const kids = children.get(task.id) ?? [];
      list.push({ task, depth, childCount: kids.length });
      if (!filtering && collapsed.has(task.id)) return;
      for (const kid of kids) walk(kid, depth + 1);
    };
    if (scopeId) {
      const root = taskMap.get(scopeId);
      if (root) walk(root, 0);
    } else {
      for (const root of children.get(null) ?? []) walk(root, 0);
    }
    return list;
  }, [children, collapsed, scopeId, taskMap, tasks, query, dueFilter]);

  const containerRef = useRef<HTMLDivElement>(null);
  const treeFocus = useAppStore((state) => state.treeFocus);

  useEffect(() => {
    if (!focusId || editingId) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-tree-row="${focusId}"]`);
    el?.focus();
    setFocusId(null);
  }, [focusId, editingId]);

  // 外部请求定位（右键“拆解/在树中编辑”）：展开祖先、滚动、聚焦
  useEffect(() => {
    if (!treeFocus) return;
    const target = treeFocus.id;
    const ancestors: string[] = [];
    let parent = taskMap.get(target)?.parentId ?? null;
    while (parent) {
      ancestors.push(parent);
      parent = taskMap.get(parent)?.parentId ?? null;
    }
    setCollapsed((prev) => {
      if (ancestors.every((id) => !prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ancestors) next.delete(id);
      return next;
    });
    setFocusId(target);
    window.setTimeout(() => {
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-tree-row="${target}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, 30);
  }, [treeFocus, taskMap]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const lastOrderOf = (parentId: string | null) =>
    (children.get(parentId) ?? []).reduce((max, item) => Math.max(max, item.sortOrder), 0);

  const startRename = (task: Task) => {
    setEditingId(task.id);
    setDraft(task.title);
  };

  const commitRename = async (task: Task) => {
    const next = draft.trim();
    setEditingId(null);
    setFocusId(task.id);
    if (next && next !== task.title) await updateTask(task.id, { title: next });
  };

  const addAfter = async (task: Task) => {
    // 顶层节点（项目）没有视图内的同级：回车 = 新建子任务；子节点则插入到它后面
    const isTopLevel = !task.parentId;
    const parentId = isTopLevel ? task.id : task.parentId;
    const created = await createTask({
      title: "新任务",
      parentId,
      afterId: isTopLevel ? null : task.id,
    });
    if (created) {
      if (parentId) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      setEditingId(created.id);
      setDraft("新任务");
    }
  };

  const addChild = async (task: Task) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    const created = await createTask({ title: "新任务", parentId: task.id });
    if (created) {
      setEditingId(created.id);
      setDraft("新任务");
    }
  };

  const indent = async (task: Task) => {
    if (scopeId && task.id === scopeId) return;
    const siblings = children.get(task.parentId) ?? [];
    const index = siblings.findIndex((item) => item.id === task.id);
    const previous = siblings[index - 1];
    if (!previous) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(previous.id);
      return next;
    });
    await updateTask(task.id, {
      parentId: previous.id,
      sortOrder: lastOrderOf(previous.id) + 1,
    });
    setFocusId(task.id);
  };

  const outdent = async (task: Task) => {
    if (!task.parentId) return;
    if (scopeId && task.parentId === scopeId) return;
    const parent = taskMap.get(task.parentId);
    if (!parent) return;
    const parentSiblings = children.get(parent.parentId) ?? [];
    const parentIndex = parentSiblings.findIndex((item) => item.id === parent.id);
    const next = parentSiblings[parentIndex + 1];
    const sortOrder = next ? (parent.sortOrder + next.sortOrder) / 2 : parent.sortOrder + 1;
    await updateTask(task.id, { parentId: parent.parentId ?? "", sortOrder });
    setFocusId(task.id);
  };

  const move = async (task: Task, direction: -1 | 1) => {
    const siblings = children.get(task.parentId) ?? [];
    const index = siblings.findIndex((item) => item.id === task.id);
    const target = siblings[index + direction];
    if (!target) return;
    await updateTask(task.id, { sortOrder: target.sortOrder });
    await updateTask(target.id, { sortOrder: task.sortOrder });
    setFocusId(task.id);
  };

  const isDescendant = (candidate: string, ancestor: string): boolean => {
    let current = taskMap.get(candidate);
    const guard = new Set<string>();
    while (current?.parentId && !guard.has(current.id)) {
      guard.add(current.id);
      if (current.parentId === ancestor) return true;
      current = taskMap.get(current.parentId);
    }
    return false;
  };

  const applyDrop = async (draggedId: string, hint: { id: string; pos: DropPos }) => {
    if (draggedId === hint.id || isDescendant(hint.id, draggedId)) return;
    const target = taskMap.get(hint.id);
    if (!target) return;

    if (hint.pos === "child") {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      await updateTask(draggedId, {
        parentId: target.id,
        sortOrder: lastOrderOf(target.id) + 1,
      });
      return;
    }

    const parentId = target.parentId;
    if (parentId === draggedId) return;
    const siblings = (children.get(parentId) ?? []).filter((item) => item.id !== draggedId);
    const index = siblings.findIndex((item) => item.id === target.id);
    let sortOrder: number;
    if (hint.pos === "before") {
      const previous = siblings[index - 1];
      sortOrder = previous ? (previous.sortOrder + target.sortOrder) / 2 : target.sortOrder - 1;
    } else {
      const next = siblings[index + 1];
      sortOrder = next ? (target.sortOrder + next.sortOrder) / 2 : target.sortOrder + 1;
    }
    await updateTask(draggedId, { parentId: parentId ?? "", sortOrder });
  };

  const beginReorder = (task: Task, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let hint: { id: string; pos: DropPos } | null = null;

    const onMove = (moveEvent: PointerEvent) => {
      if (!active) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
        active = true;
        setDragId(task.id);
      }
      const el = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-tree-row]");
      if (!(el instanceof HTMLElement)) {
        hint = null;
        setDropHint(null);
        return;
      }
      const targetId = el.dataset.treeRow;
      if (!targetId || targetId === task.id || isDescendant(targetId, task.id)) {
        hint = null;
        setDropHint(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const ratio = (moveEvent.clientY - rect.top) / Math.max(1, rect.height);
      const pos: DropPos = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "child";
      hint = { id: targetId, pos };
      setDropHint(hint);
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const finalHint = hint;
      const wasActive = active;
      hint = null;
      active = false;
      setDragId(null);
      setDropHint(null);
      if (commit && wasActive && finalHint) void applyDrop(task.id, finalHint);
    };

    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const focusIndex = (index: number) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (target) setFocusId(target.task.id);
  };

  const onKeyDown = async (event: React.KeyboardEvent<HTMLElement>, task: Task) => {
    const index = rows.findIndex((row) => row.task.id === task.id);
    const hasChildren = (children.get(task.id) ?? []).length > 0;
    const isScopeRoot = Boolean(scopeId) && task.id === scopeId;

    if (event.target instanceof HTMLInputElement) return;

    if (event.key === "Enter") {
      event.preventDefault();
      await addAfter(task);
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      startRename(task);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) await outdent(task);
      else await indent(task);
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      await move(task, event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusIndex(index + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (hasChildren && !collapsed.has(task.id)) toggleCollapse(task.id);
      else if (task.parentId && !(scopeId && task.parentId === scopeId)) setFocusId(task.parentId);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!hasChildren) return;
      if (collapsed.has(task.id)) toggleCollapse(task.id);
      else focusIndex(index + 1);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      await completeTask(task.id, task.status !== "done");
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (isScopeRoot) return;
      if (window.confirm(`删除「${task.title}」及其子任务？`)) {
        await deleteTask(task.id);
      }
    }
  };

  const renderRow = (task: Task, depth: number, childCount: number) => {
    const kids = children.get(task.id) ?? [];
    const done = task.status === "done";
    const allDone = kids.length > 0 && kids.every((kid) => kid.status === "done");
    const someDone = kids.some((kid) => kid.status === "done");
    const checked = done || (kids.length > 0 && allDone);
    const placement = placementMap.get(task.id);
    const isCollapsed = collapsed.has(task.id);
    const tagList = (taskTags[task.id] ?? [])
      .map((id) => data?.tags.find((tag) => tag.id === id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
    const color = colorForTask(
      task,
      taskMap,
      taskTags[task.id] ?? [],
      data?.tags ?? [],
      data?.settings ?? {},
    );
    const hint = dropHint?.id === task.id ? dropHint.pos : null;
    const editing = editingId === task.id;

    return (
      <div
        key={task.id}
        data-tree-row={task.id}
        tabIndex={0}
        role="treeitem"
        aria-selected={selectedId === task.id}
        aria-expanded={childCount > 0 ? !isCollapsed : undefined}
        className={[
          "group flex min-h-8 items-center gap-1 rounded-md border border-transparent pr-1 text-xs outline-none",
          selectedId === task.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
          "focus-visible:ring-1 focus-visible:ring-emerald-400/60",
          dragId === task.id ? "opacity-40" : "",
          hint === "before" ? "border-t-emerald-400" : "",
          hint === "after" ? "border-b-emerald-400" : "",
          hint === "child" ? "bg-emerald-400/10 ring-1 ring-emerald-400/40" : "",
        ].join(" ")}
        style={{ paddingLeft: depth * 14 + 4 }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const target = event.target as HTMLElement;
          if (target.closest("button") || target.closest("input")) return;
          if (dragMode === "chart")
            beginTaskDrag(task.id, task.title, event.clientX, event.clientY);
          else beginReorder(task, event);
        }}
        onClick={() => {
          if (justDragged()) return;
          onSelect(task.id);
        }}
        onDoubleClick={() => {
          if (justDragged()) return;
          if (!onOpenDetail) startRename(task);
          else onOpenDetail(task.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(task, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => void onKeyDown(event, task)}
      >
        <span
          data-tree-grip={task.id}
          className="flex h-5 w-3 shrink-0 cursor-grab items-center justify-center text-slate-600 hover:text-slate-300 active:cursor-grabbing"
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.button !== 0) return;
            beginReorder(task, event);
          }}
          title="拖动调整顺序/层级"
        >
          <GripVertical size={11} className="opacity-0 group-hover:opacity-100" />
        </span>

        <button
          type="button"
          tabIndex={-1}
          className="flex h-5 w-4 items-center justify-center text-slate-600 hover:text-slate-300"
          onClick={(event) => {
            event.stopPropagation();
            if (childCount > 0) toggleCollapse(task.id);
          }}
          aria-label={isCollapsed ? "展开" : "折叠"}
        >
          {childCount > 0 ? (
            isCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronDown size={12} />
            )
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
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

        {editing ? (
          <input
            autoFocus
            defaultValue={draft}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commitRename(task)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitRename(task);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setEditingId(null);
              } else if (event.key === "Tab") {
                event.preventDefault();
                void commitRename(task);
              }
              event.stopPropagation();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="min-w-0 flex-1 rounded bg-[var(--panel)] px-1 text-xs text-slate-100 outline-none ring-1 ring-emerald-400/40"
          />
        ) : (
          <span
            className={[
              "min-w-0 flex-1 truncate",
              done ? "text-slate-500 line-through" : "text-slate-300",
            ].join(" ")}
            title={task.title}
          >
            {shortTitle(task.title, compact ? 18 : 24)}
          </span>
        )}

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
              isOverdue(task, today)
                ? "bg-red-400/10 text-red-300"
                : task.effectiveDue === today
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

        {childCount > 0 ? (
          <span className="shrink-0 text-[9px] text-slate-600">
            {kids.filter((kid) => kid.status === "done").length}/{childCount}
          </span>
        ) : null}

        <button
          type="button"
          tabIndex={-1}
          className="hidden h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-white/10 hover:text-slate-200 group-hover:flex"
          onClick={(event) => {
            event.stopPropagation();
            void addChild(task);
          }}
          title="新建子任务"
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="hidden h-5 w-5 items-center justify-center rounded text-red-300/70 hover:bg-red-400/10 hover:text-red-300 group-hover:flex"
          onClick={(event) => {
            event.stopPropagation();
            if (window.confirm(`删除「${task.title}」及其子任务？`)) void deleteTask(task.id);
          }}
          title="删除"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[11px] leading-relaxed text-slate-500">
        {scopeId ? "这个节点还没有子任务。" : "还没有项目。"}
        <br />
        {scopeId ? "按 Enter 新建子任务。" : "点上方「项目」创建第一个。"}
      </div>
    );
  }

  return (
    <div ref={containerRef} role="tree" className="space-y-0.5">
      {rows.map(({ task, depth, childCount }) => renderRow(task, depth, childCount))}
    </div>
  );
}
