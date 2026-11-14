import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Task } from "../data/types";
import { buildChildren } from "../lib/board";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface DecompositionModalProps {
  rootId: string | null;
  onClose: () => void;
}

export function DecompositionModal({ rootId, onClose }: DecompositionModalProps) {
  const data = useAppStore((state) => state.data);
  const createTask = useAppStore((state) => state.createTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const [selectedId, setSelectedId] = useState<string | null>(rootId);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const tasks = data?.tasks ?? [];
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const children = useMemo(() => buildChildren(tasks), [tasks]);
  const root = rootId ? taskMap.get(rootId) : null;

  useEffect(() => {
    setSelectedId(rootId);
    setTitles({});
  }, [rootId]);

  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLInputElement>(`[data-decomp-task="${focusId}"] input`);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId, tasks]);

  if (!root) return null;

  const rows: Array<{ task: Task; depth: number }> = [];
  const walk = (task: Task, depth: number) => {
    rows.push({ task, depth });
    for (const child of children.get(task.id) ?? []) walk(child, depth + 1);
  };
  walk(root, 0);

  const siblingsOf = (task: Task) => children.get(task.parentId) ?? [];

  const addChild = async (parentId: string) => {
    const created = await createTask({ title: "新任务", parentId });
    if (created) {
      setSelectedId(created.id);
      setFocusId(created.id);
    }
  };

  const addSibling = async (task: Task) => {
    const created = await createTask({ title: "新任务", parentId: task.parentId });
    if (created) {
      setSelectedId(created.id);
      setFocusId(created.id);
    }
  };

  const indent = async (task: Task) => {
    const siblings = siblingsOf(task);
    const index = siblings.findIndex((item) => item.id === task.id);
    const previous = siblings[index - 1];
    if (!previous) return;
    await updateTask(task.id, { parentId: previous.id });
    setSelectedId(task.id);
  };

  const outdent = async (task: Task) => {
    if (!task.parentId) return;
    const parent = taskMap.get(task.parentId);
    if (!parent) return;
    await updateTask(task.id, { parentId: parent.parentId ?? "" });
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

  const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>, task: Task) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await addSibling(task);
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      await indent(task);
    } else if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      await outdent(task);
    } else if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      await move(task, -1);
    } else if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      await move(task, 1);
    }
  };

  return (
    <Modal
      open={Boolean(rootId)}
      title={`拆解：${root.title}`}
      subtitle="Enter 新建同级 · Tab 缩进 · Shift+Tab 反缩进 · Alt+↑/↓ 移动"
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => void addChild(root.id)}
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
        {rows.map(({ task, depth }) => {
          const done = task.status === "done";
          return (
            <div
              key={task.id}
              data-decomp-task={task.id}
              className={[
                "group flex items-center gap-1.5 rounded-md px-2 py-1",
                selectedId === task.id ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
              ].join(" ")}
              style={{ paddingLeft: depth * 22 + 8 }}
              onClick={() => setSelectedId(task.id)}
            >
              <span className="text-slate-600">
                {depth > 0 ? <CornerDownRight size={12} /> : <span className="inline-block w-3" />}
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
                className={[
                  "min-w-0 flex-1 bg-transparent text-sm outline-none",
                  done ? "text-slate-500 line-through" : "text-slate-200",
                ].join(" ")}
              />
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
