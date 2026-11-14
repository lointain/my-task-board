import {
  AlertTriangle,
  CalendarClock,
  GripVertical,
  MoveRight,
  Tag as TagIcon,
} from "lucide-react";
import type { Placement, Tag, Task } from "../data/types";
import { BOARD_LABEL, dateKey } from "../lib/board";
import { QUADRANTS, quadrantOf } from "../lib/quadrant";

interface ChartTooltipProps {
  task: Task;
  placement: Placement;
  tags: Tag[];
  path: string[];
  container: { width: number; height: number };
  pointer: { x: number; y: number };
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

export function ChartTooltip({
  task,
  placement,
  tags,
  path,
  container,
  pointer,
}: ChartTooltipProps) {
  const quadrant = QUADRANTS[quadrantOf(placement.x, placement.y)];
  const status = STATUS_META[task.status] ?? STATUS_META.todo;
  const today = dateKey(new Date());
  const overdue = Boolean(task.effectiveDue && task.effectiveDue < today);
  const dueIn = task.effectiveDue ? daysBetween(today, task.effectiveDue) : null;

  const offsetX = pointer.x > container.width - 260 ? -256 : 18;
  const offsetY = pointer.y > container.height - 220 ? -190 : 14;

  const dueText = (() => {
    if (!task.effectiveDue) return "无截止日";
    if (overdue) return `逾期 ${Math.abs(dueIn ?? 0)} 天（${task.effectiveDue}）`;
    if (dueIn === 0) return `今天到期（${task.effectiveDue}）`;
    return `还有 ${dueIn} 天（${task.effectiveDue}）`;
  })();

  const momentumText =
    placement.momentumMode === "auto"
      ? `自动 · ${placement.vx.toFixed(2)}/天`
      : `手动 · ${placement.vx.toFixed(2)}/天`;

  const daysToEdge =
    placement.vx > 0 ? Math.max(0, Math.round((placement.x - 50) / placement.vx)) : null;

  return (
    <div
      className="pointer-events-none absolute z-30 w-[248px] overflow-hidden rounded-xl border border-[var(--line)] bg-[#0d131a]/96 shadow-2xl backdrop-blur-sm"
      style={{ left: pointer.x + offsetX, top: pointer.y + offsetY }}
    >
      <div className="border-b border-[var(--line-soft)] px-3 py-2">
        <div className="flex items-start gap-1.5">
          <GripVertical size={12} className="mt-0.5 shrink-0 text-slate-600" />
          <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-slate-100">
            {task.title}
          </span>
        </div>
        {path.length > 1 ? (
          <div className="mt-1 truncate pl-[18px] text-[9px] text-slate-500">
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
            style={{ backgroundColor: `${quadrant.color}1a`, color: quadrant.color }}
          >
            {quadrant.short} · {quadrant.label}
          </span>
          <span className="ml-auto text-slate-500">{quadrant.description}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-slate-500">紧迫</span>
          <span className="font-mono text-slate-200">{Math.round(placement.x)}</span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">重要</span>
          <span className="font-mono text-slate-200">{Math.round(placement.y)}</span>
          <span className="ml-auto text-[9px] text-slate-600">
            {placement.board === "week" ? "周级" : BOARD_LABEL[placement.board]}
          </span>
        </div>

        <div className="flex items-start gap-1.5">
          <CalendarClock
            size={11}
            className={overdue ? "mt-px shrink-0 text-red-300" : "mt-px shrink-0 text-slate-500"}
          />
          <span className={overdue ? "text-red-300" : "text-slate-400"}>{dueText}</span>
        </div>

        {task.dueSource && task.dueSource !== "own" ? (
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={11} className="mt-px shrink-0 text-slate-600" />
            <span className="text-slate-600">截止日继承自「{task.dueSource}」</span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          <MoveRight size={11} className="shrink-0 text-slate-500" />
          <span className="text-slate-400">{momentumText}</span>
          {daysToEdge !== null && placement.momentumMode === "auto" ? (
            <span className="ml-auto text-[9px] text-slate-600">
              {daysToEdge > 0 ? `${daysToEdge} 天后进 Q1` : "已在 Q1"}
            </span>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <TagIcon size={10} className="text-slate-600" />
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 rounded border border-[var(--line)] px-1 py-px text-[9px] text-slate-400"
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

        <div className="flex items-center gap-2 pt-0.5 text-[9px] text-slate-600">
          <span>{task.noteJson ? "有说明" : "无说明"}</span>
          <span className="text-slate-700">|</span>
          <span>双击打开详情</span>
        </div>
      </div>
    </div>
  );
}
