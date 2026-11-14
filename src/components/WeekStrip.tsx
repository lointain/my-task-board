import type { Board } from "../data/types";
import { BOARD_LABEL, weekDays } from "../lib/board";
import { useAppStore } from "../store/useAppStore";

export function WeekStrip() {
  const board = useAppStore((state) => state.board);
  const setBoard = useAppStore((state) => state.setBoard);
  const data = useAppStore((state) => state.data);
  const days = weekDays();

  const countFor = (target: Board) => {
    if (!data) return 0;
    if (target === "week") return data.placements.length;
    return data.placements.filter((placement) => placement.board === target).length;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {days.map((day) => {
        const active = board === day.board;
        const count = countFor(day.board);
        return (
          <button
            key={day.board}
            type="button"
            onClick={() => setBoard(day.board)}
            className={[
              "group flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
              active
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-transparent text-slate-400 hover:border-[var(--line)] hover:bg-white/[0.04] hover:text-slate-200",
            ].join(" ")}
          >
            <span className="font-medium">{day.short}</span>
            <span className="text-[10px] text-slate-500">
              {day.date.getMonth() + 1}/{day.date.getDate()}
            </span>
            {day.isToday ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
            {count > 0 ? (
              <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] text-slate-400">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setBoard("week")}
        className={[
          "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors",
          board === "week"
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border-transparent text-slate-400 hover:border-[var(--line)] hover:bg-white/[0.04] hover:text-slate-200",
        ].join(" ")}
      >
        <span className="font-medium">周</span>
        <span className="text-[10px] text-slate-500">全景</span>
        {countFor("week") > 0 ? (
          <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] text-slate-400">
            {countFor("week")}
          </span>
        ) : null}
      </button>
      <span className="ml-1 hidden shrink-0 text-[10px] text-slate-600 xl:inline">
        {BOARD_LABEL[board]} · 不翻周
      </span>
    </div>
  );
}
