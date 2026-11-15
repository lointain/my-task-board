import { GripVertical } from "lucide-react";
import { BOARD_LABEL } from "../lib/board";
import { useDragStore } from "../lib/drag";

export function DragGhost() {
  const taskId = useDragStore((state) => state.taskId);
  const title = useDragStore((state) => state.title);
  const x = useDragStore((state) => state.x);
  const y = useDragStore((state) => state.y);
  const over = useDragStore((state) => state.over);

  if (!taskId) return null;

  const hint =
    over?.kind === "chart"
      ? "松开：放到这张图"
      : over?.kind === "board"
        ? `松开：放到${BOARD_LABEL[over.board]}`
        : "拖到日期的标签或图上";

  return (
    <div
      className="pointer-events-none fixed z-[80] flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-[var(--panel)]/95 px-2.5 py-1.5 text-[11px] text-[var(--t1)] shadow-xl"
      style={{ left: x + 14, top: y + 14 }}
    >
      <GripVertical size={12} className="text-emerald-300" />
      <span className="max-w-[220px] truncate">{title}</span>
      <span
        className={[
          "rounded px-1 text-[9px]",
          over ? "bg-emerald-400/15 text-emerald-200" : "bg-[var(--hover-strong)] text-[var(--t3)]",
        ].join(" ")}
      >
        {hint}
      </span>
    </div>
  );
}
