import { Archive, CheckCircle2, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Task } from "../data/types";
import { dateKey, shortTitle, startOfWeek } from "../lib/board";
import { t } from "../lib/i18n";
import { useAppStore } from "../store/useAppStore";

interface ArchiveDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}

type ArchiveTab = "done" | "archived";

export function ArchiveDrawer({ open, onClose, onOpenDetail }: ArchiveDrawerProps) {
  const tasks = useAppStore((state) => state.data?.tasks ?? null);
  const completeTask = useAppStore((state) => state.completeTask);
  const [tab, setTab] = useState<ArchiveTab>("done");

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const list = useMemo(() => tasks ?? [], [tasks]);
  const taskMap = useMemo(() => new Map(list.map((task) => [task.id, task])), [list]);

  const doneTasks = useMemo(
    () =>
      list
        .filter((task) => task.status === "done")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [list],
  );
  const archivedTasks = useMemo(
    () =>
      list
        .filter((task) => task.status === "archived")
        .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)),
    [list],
  );

  const doneThisWeek = useMemo(() => {
    const since = dateKey(startOfWeek());
    return doneTasks.filter((task) => (task.completedAt ?? "").slice(0, 10) >= since).length;
  }, [doneTasks]);

  const pathOf = (task: Task) => {
    const chain: string[] = [];
    let current: Task | undefined = task;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      chain.unshift(shortTitle(current.title) || t("未命名"));
      current = current.parentId ? taskMap.get(current.parentId) : undefined;
    }
    return chain.join(" / ");
  };

  if (!open) return null;

  const rows = tab === "done" ? doneTasks : archivedTasks;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-[var(--t1)]">
              <Archive size={14} className="text-[var(--t3)]" />
              {t("已完成 / 已归档")}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--t3)]">
              {t("本周完成 {n} / 共 {m}", { n: doneThisWeek, m: doneTasks.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--t3)] hover:bg-[var(--hover)] hover:text-[var(--t1)]"
            aria-label={t("关闭")}
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-[var(--line-soft)] px-3 py-2">
          {(
            [
              { id: "done", label: t("已完成"), count: doneTasks.length },
              { id: "archived", label: t("已归档"), count: archivedTasks.length },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px]",
                tab === item.id
                  ? "bg-[var(--hover-strong)] text-[var(--t1)]"
                  : "text-[var(--t3)] hover:bg-[var(--hover)]",
              ].join(" ")}
            >
              {item.label}
              <span className="text-[10px] text-[var(--t4)]">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-[11px] text-[var(--t4)]">
              {tab === "done" ? t("还没有完成的任务") : t("还没有归档的任务")}
            </p>
          ) : (
            rows.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--hover)]"
              >
                <CheckCircle2 size={13} className="shrink-0 text-accent-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-[var(--t2)]">
                    {task.title || t("未命名")}
                  </div>
                  <div className="truncate text-[9px] text-[var(--t4)]">
                    {pathOf(task)}
                    {task.completedAt ? ` · ${task.completedAt.slice(0, 10)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void completeTask(task.id, false)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--t3)] hover:text-[var(--t1)]"
                  title={t("取消完成")}
                >
                  <RotateCcw size={11} /> {t("取消完成")}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDetail(task.id)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--t3)] hover:text-[var(--t1)]"
                >
                  {t("打开详情")}
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
