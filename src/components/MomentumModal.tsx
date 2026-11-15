import { useEffect, useState } from "react";
import type { Placement, Task } from "../data/types";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface MomentumModalProps {
  task: Task | null;
  placement: Placement | null;
  onClose: () => void;
}

export function MomentumModal({ task, placement, onClose }: MomentumModalProps) {
  const setMomentum = useAppStore((state) => state.setMomentum);
  const [dueAt, setDueAt] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [vx, setVx] = useState(0.25);
  const [vy, setVy] = useState(0);

  useEffect(() => {
    if (!task || !placement) return;
    setDueAt(task.dueAt ?? "");
    setMode(placement.momentumMode);
    setVx(placement.vx);
    setVy(placement.vy);
  }, [task, placement]);

  if (!task || !placement) return null;

  return (
    <Modal
      open={Boolean(task && placement)}
      title="动量 / 截止日期"
      subtitle={`${task.title} · ${placement.board === "week" ? "周图" : placement.board.toUpperCase()}`}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[11px] text-slate-300 hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              void setMomentum({
                taskId: task.id,
                dueAt: dueAt.trim() ? dueAt : null,
                mode,
                vx,
                vy,
              });
              onClose();
            }}
            className="h-8 rounded-lg bg-emerald-400 px-3 text-[11px] font-medium text-emerald-950 hover:bg-emerald-300"
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] text-slate-400">截止日期</span>
          <input
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/40"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {[
              { label: "今天", days: 0 },
              { label: "+1 天", days: 1 },
              { label: "+3 天", days: 3 },
              { label: "+7 天", days: 7 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + preset.days);
                  const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
                  setDueAt(key);
                }}
                className="h-6 rounded-md border border-[var(--line)] px-2 text-[10px] text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDueAt("")}
              className="h-6 rounded-md px-2 text-[10px] text-slate-500 hover:text-slate-300"
            >
              清除
            </button>
          </div>
          <span className="mt-1 block text-[10px] text-slate-600">
            只影响动量和逾期筛选；不影响是否上图。留空表示无截止日。
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] text-slate-400">动量模式</span>
          <div className="flex gap-1 rounded-lg border border-[var(--line)] p-0.5">
            {(["auto", "manual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={[
                  "h-7 flex-1 rounded-md text-[11px]",
                  mode === value
                    ? "bg-white/[0.08] text-slate-100"
                    : "text-slate-500 hover:text-slate-300",
                ].join(" ")}
              >
                {value === "auto" ? "自动（按截止日）" : "手动"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] text-slate-400">x 速度（点/天）</span>
            <input
              type="number"
              step="0.05"
              value={vx}
              disabled={mode === "auto"}
              onChange={(event) => setVx(Number(event.target.value))}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-slate-200 outline-none disabled:opacity-40"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] text-slate-400">y 速度（点/天）</span>
            <input
              type="number"
              step="0.05"
              value={vy}
              onChange={(event) => setVy(Number(event.target.value))}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-slate-200 outline-none"
            />
          </label>
        </div>

        <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[10px] leading-relaxed text-slate-500">
          自动模式：x 会朝 100 推进，越接近截止日越快。手动模式：按你设置的 x/y
          速度移动。顺延到下一个日板时，x 会重算，y 保留。
        </p>
      </div>
    </Modal>
  );
}
