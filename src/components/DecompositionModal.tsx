import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../data/types";
import { buildChildren } from "../lib/board";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface DecompositionModalProps {
  rootId: string | null;
  onClose: () => void;
}

interface Row {
  task: Task;
  depth: number;
  childCount: number;
}

type DropPos = "before" | "after" | "child";

interface DropHint {
  id: string;
  pos: DropPos;
}

export function DecompositionModal({ rootId, onClose }: DecompositionModalProps) {
  const data = useAppStore((state) => state.data);
  const createTask = useAppStore((state) => state.createTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const [selectedId, setSelectedId] = useState<string | null>(rootId);
  const [focusId, setFocusId] = useState<string | null>(rootId);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  const tasks = data?.tasks ?? [];
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const children = useMemo(() => buildChildren(tasks), [tasks]);
  const root = rootId ? taskMap.get(rootId) : null;

  useEffect(() => {
    setSelectedId(rootId);
    setFocusId(rootId);
    setTitles({});
    setCollapsed(new Set());
    setDropHint(null);
  }, [rootId]);

  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLInputElement>(`[data-decomp-task="${focusId}"] input`);
    if (!el) return;
    el.focus();
    el.select();
    setFocusId(null);
  }, [focusId, tasks]);

  const rows = useMemo<Row[]>(() => {
    if (!root) return [];
    const list: Row[] = [];
    const walk = (task: Task, depth: number) => {
      const kids = children.get(task.id) ?? [];
      list.push({ task, depth, childCount: kids.length });
      if (collapsed.has(task.id)) return;
      for (const child of kids) walk(child, depth + 1);
    };
    walk(root, 0);
    return list;
  }, [root, children, collapsed]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!root) return null;

  const rootTask = root;
  const siblingsOf = (task: Task) => children.get(task.parentId) ?? [];
  const lastOrderOf = (parentId: string | null) => {
    const siblings = children.get(parentId) ?? [];
    return siblings.reduce((max, item) => Math.max(max, item.sortOrder), 0);
  };

  const focusIndex = (index: number) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (target) setFocusId(target.task.id);
  };

  const addChild = async (parentId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    const created = await createTask({
      title: "新任务",
      parentId,
      afterId: null,
    });
    if (created) {
      setSelectedId(created.id);
      setFocusId(created.id);
    }
  };

  /** 在当前节点之后插入同级；根节点没有视图内同级，改为新建子节点。 */
  const addAfter = async (task: Task) => {
    if (task.id === rootTask.id) {
      await addChild(rootTask.id);
      return;
    }
    const created = await createTask({
      title: "新任务",
      parentId: task.parentId,
      afterId: task.id,
    });
    if (created) {
      setSelectedId(created.id);
      setFocusId(created.id);
    }
  };

  const indent = async (task: Task) => {
    if (task.id === rootTask.id) return;
    const siblings = siblingsOf(task);
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
    setSelectedId(task.id);
  };

  const outdent = async (task: Task) => {
    if (task.id === rootTask.id || !task.parentId) return;
    const parent = taskMap.get(task.parentId);
    if (!parent) return;
    if (parent.id === rootTask.id) {
      // 已经是根节点的直接子节点，再往上就是视图外，保持不动
      return;
    }
    const parentSiblings = siblingsOf(parent);
    const parentIndex = parentSiblings.findIndex((item) => item.id === parent.id);
    const next = parentSiblings[parentIndex + 1];
    const sortOrder = next ? (parent.sortOrder + next.sortOrder) / 2 : parent.sortOrder + 1;
    await updateTask(task.id, {
      parentId: parent.parentId ?? "",
      sortOrder,
    });
    setSelectedId(task.id);
  };

  const move = async (task: Task, direction: -1 | 1) => {
    const siblings = siblingsOf(task);
    const index = siblings.findIndex((item) => item.id === task.id);
    const target = siblings[index + direction];
    if (!target) return;
    const a = task.sortOrder;
    const b = target.sortOrder;
    await updateTask(task.id, { sortOrder: b });
    await updateTask(target.id, { sortOrder: a });
    setSelectedId(task.id);
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

  const applyDrop = async (draggedId: string, hint: DropHint) => {
    if (draggedId === hint.id) return;
    if (isDescendant(hint.id, draggedId)) return;
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

  const beginDrag = (task: Task, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let hint: DropHint | null = null;

    const onMove = (moveEvent: PointerEvent) => {
      if (!active) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
        active = true;
        setDragId(task.id);
      }
      const el = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-decomp-task]");
      if (!(el instanceof HTMLElement)) {
        hint = null;
        setDropHint(null);
        return;
      }
      const targetId = el.dataset.decompTask;
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
      window.removeEventListener("keydown", onKey);
      const finalHint = hint;
      hint = null;
      const wasActive = active;
      active = false;
      setDragId(null);
      setDropHint(null);
      if (commit && wasActive && finalHint) void applyDrop(task.id, finalHint);
    };

    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") finish(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };

  const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>, task: Task) => {
    const index = rows.findIndex((row) => row.task.id === task.id);
    const isRoot = task.id === rootTask.id;
    const hasChildren = (children.get(task.id) ?? []).length > 0;

    if (event.key === "Enter") {
      event.preventDefault();
      await addAfter(task);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        if (!isRoot) await outdent(task);
      } else if (!isRoot) {
        await indent(task);
      }
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

    // ←/→ 留给光标移动；折叠改用 Alt+←/→
    if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      if (!hasChildren) return;
      event.preventDefault();
      if (event.key === "ArrowRight" && collapsed.has(task.id)) toggleCollapse(task.id);
      if (event.key === "ArrowLeft" && !collapsed.has(task.id)) toggleCollapse(task.id);
    }
  };

  return (
    <Modal
      open={Boolean(rootId)}
      title={`拆解：${root.title}`}
      subtitle="Enter 在下方插入 · Tab/Shift+Tab 缩进 · Alt+↑/↓ 换位 · ↑/↓ 选行 · Alt+←/→ 折叠 · 拖动行可换位/换父级"
      onClose={onClose}
      width="max-w-4xl"
      dismissOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <>
          <button
            type="button"
            onClick={() => void addChild(rootTask.id)}
            className="mr-auto flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] px-3 text-[11px] text-slate-300 hover:bg-white/5"
          >
            <Plus size={13} /> 新建子任务
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg bg-emerald-400 px-3 text-[11px] font-medium text-emerald-950 hover:bg-emerald-300"
          >
            完成
          </button>
        </>
      }
    >
      <div className="space-y-0.5">
        {rows.map(({ task, depth, childCount }) => {
          const done = task.status === "done";
          const isCollapsed = collapsed.has(task.id);
          const hint = dropHint?.id === task.id ? dropHint.pos : null;
          return (
            <div
              key={task.id}
              data-decomp-task={task.id}
              className={[
                "group flex items-center gap-1 rounded-md border px-2 py-1",
                selectedId === task.id
                  ? "border-transparent bg-white/[0.07]"
                  : "border-transparent hover:bg-white/[0.03]",
                dragId === task.id ? "opacity-40" : "",
                hint === "before" ? "border-t-emerald-400" : "",
                hint === "after" ? "border-b-emerald-400" : "",
                hint === "child" ? "bg-emerald-400/10 ring-1 ring-emerald-400/40" : "",
              ].join(" ")}
              style={{ paddingLeft: depth * 22 + 8 }}
              onClick={() => setSelectedId(task.id)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const target = event.target as HTMLElement;
                if (target.closest("input") || target.closest("button")) return;
                beginDrag(task, event);
              }}
            >
              <span
                className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-slate-600 hover:text-slate-300 active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  beginDrag(task, event);
                }}
                title="拖动调整顺序/层级"
              >
                <GripVertical size={12} />
              </span>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (childCount > 0) toggleCollapse(task.id);
                }}
                className={[
                  "flex h-5 w-4 shrink-0 items-center justify-center",
                  childCount > 0 ? "text-slate-500 hover:text-slate-300" : "text-transparent",
                ].join(" ")}
                tabIndex={-1}
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

              <span className="shrink-0 text-slate-600">
                {depth > 0 ? <CornerDownRight size={12} /> : <span className="inline-block w-0" />}
              </span>

              <input
                value={titles[task.id] ?? task.title}
                onChange={(event) =>
                  setTitles((prev) => ({ ...prev, [task.id]: event.target.value }))
                }
                onBlur={() => {
                  const next = (titles[task.id] ?? task.title).trim();
                  if (next && next !== task.title) {
                    void updateTask(task.id, { title: next });
                  }
                  setTitles((prev) => {
                    const copy = { ...prev };
                    delete copy[task.id];
                    return copy;
                  });
                }}
                onKeyDown={(event) => void onKeyDown(event, task)}
                onFocus={() => setSelectedId(task.id)}
                onPointerDown={(event) => event.stopPropagation()}
                className={[
                  "min-w-0 flex-1 bg-transparent text-sm outline-none",
                  done ? "text-slate-500 line-through" : "text-slate-200",
                ].join(" ")}
              />

              {childCount > 0 ? (
                <span className="shrink-0 text-[10px] text-slate-600">{childCount}</span>
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void addChild(task.id);
                }}
                className="hidden h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white/10 hover:text-slate-200 group-hover:flex"
                title="添加子任务"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm("删除这个节点及其所有子任务？")) {
                    void deleteTask(task.id);
                  }
                }}
                className="hidden h-6 w-6 items-center justify-center rounded text-red-300/70 hover:bg-red-400/10 hover:text-red-300 group-hover:flex"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
