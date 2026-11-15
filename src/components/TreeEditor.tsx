import {
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  Square,
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
} from "../lib/board";
import { hitTest, useDragStore } from "../lib/drag";
import { matchesTreeFilter } from "../lib/filter";
import { useAppStore } from "../store/useAppStore";

interface TreeEditorProps {
  /** null = 整片森林；否则只显示该节点为根的子树 */
  scopeId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onContextMenu?: (task: Task, x: number, y: number) => void;
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
  selectedId,
  onSelect,
  onOpenDetail,
  onContextMenu,
  query = "",
  dueFilter = null,
}: TreeEditorProps) {
  const data = useAppStore((state) => state.data);
  const taskTags = useAppStore((state) => state.taskTags);
  const createTask = useAppStore((state) => state.createTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const completeTask = useAppStore((state) => state.completeTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const placeTaskOn = useAppStore((state) => state.placeTaskOn);
  const placeTaskAtPointer = useAppStore((state) => state.placeTaskAtPointer);
  const setBoard = useAppStore((state) => state.setBoard);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: DropPos } | null>(null);

  const treeRef = useRef<HTMLDivElement>(null);
  /** 记录一次“按下”发生时输入框是否已聚焦（区分“双击全选”和“双击打开”） */
  const pressRef = useRef<{ at: number; el: Element | null; wasFocused: boolean }>({
    at: 0,
    el: null,
    wasFocused: false,
  });
  const today = dateKey(new Date());

  const tasks = data?.tasks ?? [];
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const children = useMemo(() => buildChildren(tasks), [tasks]);
  const placementMap = useMemo(
    () => new Map((data?.placements ?? []).map((p: Placement) => [p.taskId, p])),
    [data?.placements],
  );

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

  // 外部“在树中编辑”：展开祖先、滚动、聚焦
  const treeFocus = useAppStore((state) => state.treeFocus);
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
      const next = new Set(prev);
      for (const id of ancestors) next.delete(id);
      return next;
    });
    setFocusId(target);
    window.setTimeout(() => {
      treeRef.current
        ?.querySelector<HTMLElement>(`[data-tree-row="${target}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, 30);
  }, [treeFocus, taskMap]);

  useEffect(() => {
    if (!focusId) return;
    const input = treeRef.current?.querySelector<HTMLInputElement>(
      `[data-tree-row="${focusId}"] input`,
    );
    if (!input) return;
    input.focus();
    input.select();
    setFocusId(null);
  }, [focusId]);

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

  const focusRowAt = (index: number) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (target) setFocusId(target.task.id);
  };

  const commitTitle = async (task: Task) => {
    const next = (drafts[task.id] ?? task.title).trim();
    if (!next || next === task.title) return;
    await updateTask(task.id, { title: next });
  };

  /** 回车：插入到当前节点之后；顶层节点（项目）新建子任务 */
  const addAfter = async (task: Task) => {
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
      setFocusId(created.id);
    }
  };

  const indent = async (task: Task) => {
    if (!task.parentId && scopeId === null) return;
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

  const applyReorder = async (draggedId: string, hint: { id: string; pos: DropPos }) => {
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

  /**
   * 一个把手两种用途：落到图上=上图（或落到日期标签=那天），
   * 落到树内某一行=排序/换父级。
   */
  const beginDrag = (task: Task, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let rowHint: { id: string; pos: DropPos } | null = null;

    const onMove = (moveEvent: PointerEvent) => {
      if (!active) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
        active = true;
        setDragId(task.id);
        useDragStore.getState().start(task.id, task.title, moveEvent.clientX, moveEvent.clientY);
      }

      const rowEl = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-tree-row]");
      if (rowEl instanceof HTMLElement) {
        const targetId = rowEl.dataset.treeRow;
        if (!targetId || targetId === task.id || isDescendant(targetId, task.id)) {
          rowHint = null;
          setDropHint(null);
        } else {
          const rect = rowEl.getBoundingClientRect();
          const ratio = (moveEvent.clientY - rect.top) / Math.max(1, rect.height);
          const pos: DropPos = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "child";
          rowHint = { id: targetId, pos };
          setDropHint(rowHint);
        }
        useDragStore.getState().move(moveEvent.clientX, moveEvent.clientY, null);
        return;
      }

      rowHint = null;
      setDropHint(null);
      useDragStore
        .getState()
        .move(moveEvent.clientX, moveEvent.clientY, hitTest(moveEvent.clientX, moveEvent.clientY));
    };

    const finish = (commit: boolean, clientX: number, clientY: number) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const hint = rowHint;
      const wasActive = active;
      active = false;
      setDragId(null);
      setDropHint(null);
      useDragStore.getState().end();
      if (!commit || !wasActive) return;

      if (hint) {
        void applyReorder(task.id, hint);
        return;
      }

      const el = document.elementFromPoint(clientX, clientY);
      const boardEl = el?.closest("[data-drop-board]");
      if (boardEl instanceof HTMLElement && boardEl.dataset.dropBoard) {
        const board = boardEl.dataset.dropBoard as Parameters<typeof placeTaskOn>[0];
        void placeTaskOn(board, 50, 50, task.id);
        setBoard(board);
        return;
      }
      if (el?.closest("[data-drop-chart]")) {
        void placeTaskAtPointer(task.id, clientX, clientY);
      }
    };

    const onUp = (upEvent: PointerEvent) => finish(true, upEvent.clientX, upEvent.clientY);
    const onCancel = (cancelEvent: PointerEvent) =>
      finish(false, cancelEvent.clientX, cancelEvent.clientY);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>, task: Task) => {
    const index = rows.findIndex((row) => row.task.id === task.id);
    const hasChildren = (children.get(task.id) ?? []).length > 0;

    // 输入框已经清空时再按退格 = 删除这一条
    if (event.key === "Backspace" && (drafts[task.id] ?? task.title) === "") {
      event.preventDefault();
      if (hasChildren) {
        const kids = (children.get(task.id) ?? []).length;
        if (!window.confirm(`删除「${task.title}」及其 ${kids} 个子任务？`)) return;
      }
      const prevId = rows[index - 1]?.task.id ?? null;
      await deleteTask(task.id);
      if (prevId) setFocusId(prevId);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await commitTitle(task);
      await addAfter(task);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      await commitTitle(task);
      if (event.shiftKey) await outdent(task);
      else await indent(task);
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      await commitTitle(task);
      await move(task, -1);
      return;
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      await commitTitle(task);
      await move(task, 1);
      return;
    }
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      if (!hasChildren) return;
      event.preventDefault();
      if (event.key === "ArrowRight" && collapsed.has(task.id)) toggleCollapse(task.id);
      if (event.key === "ArrowLeft" && !collapsed.has(task.id)) toggleCollapse(task.id);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      await commitTitle(task);
      focusRowAt(index - 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      await commitTitle(task);
      focusRowAt(index + 1);
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

    return (
      <div
        key={task.id}
        data-tree-row={task.id}
        role="treeitem"
        tabIndex={-1}
        aria-selected={selectedId === task.id}
        aria-expanded={childCount > 0 ? !isCollapsed : undefined}
        className={[
          "group flex min-h-8 items-center gap-1 rounded-md border border-transparent pr-1 text-xs",
          selectedId === task.id ? "bg-[var(--hover-strong)]" : "hover:bg-[var(--hover)]",
          dragId === task.id ? "opacity-40" : "",
          hint === "before" ? "border-t-accent-400" : "",
          hint === "after" ? "border-b-accent-400" : "",
          hint === "child" ? "bg-accent-400/10 ring-1 ring-accent-400/40" : "",
        ].join(" ")}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onSelect(task.id)}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          // 输入框内双击交给浏览器（选中文字），不要穿透成“打开详情”
          if (target.closest("input")) return;
          if (onOpenDetail) onOpenDetail(task.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(task, event.clientX, event.clientY);
        }}
      >
        <span
          data-tree-grip={task.id}
          className="flex h-5 w-3 shrink-0 cursor-grab items-center justify-center text-[var(--t4)] hover:text-[var(--t2)] active:cursor-grabbing"
          onPointerDown={(event) => beginDrag(task, event)}
          title="拖动：放到图上=承诺；放到行上=排序/换父级"
        >
          <GripVertical size={11} className="opacity-40 group-hover:opacity-100" />
        </span>

        <button
          type="button"
          tabIndex={-1}
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={(event) => {
            event.stopPropagation();
            void completeTask(task.id, !checked);
          }}
          title={checked ? "取消完成（含子任务）" : "完成（含子任务）"}
        >
          {checked ? (
            <CheckSquare2 size={14} className="text-accent-400" />
          ) : (
            <Square size={14} className={someDone ? "text-amber-400" : "text-[var(--t4)]"} />
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          className="flex h-5 w-4 shrink-0 items-center justify-center text-[var(--t4)] hover:text-[var(--t2)]"
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
          ) : depth > 0 ? (
            <CornerDownRight size={11} />
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        {/* 有图标就不画色点 */}
        {(() => {
          const own = task.emoji;
          let emoji = own;
          let inherited = false;
          if (!emoji && task.parentId) {
            let parent = taskMap.get(task.parentId);
            const guard = new Set<string>();
            while (parent && !guard.has(parent.id)) {
              guard.add(parent.id);
              if (parent.emoji) {
                emoji = parent.emoji;
                inherited = true;
                break;
              }
              parent = parent.parentId ? taskMap.get(parent.parentId) : undefined;
            }
          }
          if (emoji) {
            return (
              <span
                className="w-4 shrink-0 text-center text-[11px] leading-none"
                style={{ opacity: inherited ? 0.75 : 1 }}
                title={inherited ? "继承自父级" : "自定义图标"}
              >
                {emoji}
              </span>
            );
          }
          return (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
          );
        })()}

        <input
          value={drafts[task.id] ?? task.title}
          onChange={(event) => setDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))}
          onBlur={() => {
            void commitTitle(task);
            setDrafts((prev) => {
              const copy = { ...prev };
              delete copy[task.id];
              return copy;
            });
          }}
          onKeyDown={(event) => void onKeyDown(event, task)}
          onMouseDown={(event) => {
            const el = event.currentTarget;
            // 第二次按下（detail ≥ 2）拦掉浏览器的“双击选词”，改由 dblclick 全选
            if (event.detail >= 2 && document.activeElement === el) {
              event.preventDefault();
              return;
            }
            // 只记录“这一串点击开始前”是否已经聚焦
            if (event.detail <= 1) {
              pressRef.current = { at: Date.now(), el, wasFocused: document.activeElement === el };
            }
          }}
          onDoubleClick={(event) => {
            const el = event.currentTarget;
            const press = pressRef.current;
            if (press.el === el && press.wasFocused) {
              event.stopPropagation();
              el.select();
              return;
            }
            // 输入框还没聚焦时双击 = 打开详情（不拦截）
            onOpenDetail?.(task.id);
          }}
          onFocus={() => onSelect(task.id)}
          onPointerDown={(event) => event.stopPropagation()}
          spellCheck={false}
          className={[
            "min-w-0 flex-1 truncate rounded bg-transparent px-0.5 text-xs outline-none focus:bg-[var(--panel)] focus:ring-1 focus:ring-accent-400/40",
            done ? "text-[var(--t3)] line-through" : "text-[var(--t2)]",
          ].join(" ")}
        />

        {placement ? (
          <span className="shrink-0 rounded border border-accent-400/20 bg-accent-400/10 px-1 text-[9px] text-accent-300">
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
                  : "text-[var(--t3)]",
            ].join(" ")}
            title={
              task.dueSource === "own" ? "自己的截止日" : `继承自 ${task.dueSource ?? "父任务"}`
            }
          >
            {dueLabel(task)}
          </span>
        ) : null}

        {childCount > 0 ? (
          <span className="shrink-0 text-[9px] text-[var(--t4)]">
            {kids.filter((kid) => kid.status === "done").length}/{childCount}
          </span>
        ) : null}
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[11px] leading-relaxed text-[var(--t3)]">
        {scopeId ? "这个节点还没有子任务。" : "还没有项目。"}
        <br />
        {scopeId ? "按 Enter 新建子任务。" : "点上方「项目」创建第一个。"}
      </div>
    );
  }

  return (
    <div ref={treeRef} role="tree" className="space-y-0.5">
      {rows.map(({ task, depth, childCount }) => renderRow(task, depth, childCount))}
    </div>
  );
}
