import { CheckCircle2, Clock3, X } from "lucide-react";
import type { Task } from "../data/types";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface WeeklyStatsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

function StatsList({
  tasks,
  empty,
  onOpenTask,
  tone,
}: {
  tasks: Task[];
  empty: string;
  onOpenTask: (id: string) => void;
  tone: "done" | "overdue";
}) {
  return (
    <div className="min-h-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel-2)]">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--t2)]">
          {tone === "done" ? (
            <CheckCircle2 size={13} className="text-accent-400" />
          ) : (
            <Clock3 size={13} className="text-red-300" />
          )}
          {tone === "done" ? "本周完成" : "逾期"}
        </span>
        <span className="text-[10px] text-[var(--t3)]">{tasks.length}</span>
      </div>
      <div className="max-h-[46vh] overflow-y-auto p-1.5">
        {tasks.length === 0 ? (
          <p className="px-3 py-8 text-center text-[11px] text-[var(--t4)]">{empty}</p>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--hover)]"
            >
              <span
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  tone === "done" ? "bg-accent-400" : "bg-red-400",
                ].join(" ")}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--t2)]">
                {task.title}
              </span>
              <span className="shrink-0 text-[9px] text-[var(--t3)]">
                {tone === "done"
                  ? (task.completedAt ?? "").slice(0, 10)
                  : (task.effectiveDue ?? "")}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function WeeklyStatsModal({ open, onClose, onOpenTask }: WeeklyStatsModalProps) {
  const stats = useAppStore((state) => state.stats);
  if (!open) return null;

  return (
    <Modal
      open={open}
      title="周统计"
      subtitle={
        stats
          ? `${stats.weekStart} → ${stats.weekEnd} · 完成 ${stats.completedCount} · 逾期 ${stats.overdueCount}`
          : "加载中…"
      }
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StatsList
          tasks={stats?.completed ?? []}
          empty="本周还没有完成的任务"
          onOpenTask={onOpenTask}
          tone="done"
        />
        <StatsList
          tasks={stats?.overdue ?? []}
          empty="没有逾期任务"
          onOpenTask={onOpenTask}
          tone="overdue"
        />
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--t3)]">
        <span>自然周：周一 → 周日</span>
        <span className="text-[var(--t5)]">|</span>
        <span>完成倒序 / 逾期按截止日正序</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex items-center gap-1 text-[var(--t3)] hover:text-[var(--t2)]"
        >
          <X size={11} /> 关闭
        </button>
      </div>
    </Modal>
  );
}
