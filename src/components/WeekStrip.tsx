import type { Board } from "../data/types";
import { BOARD_LABEL, dateKey, weekDays } from "../lib/board";
import { useDragStore } from "../lib/drag";
import { useAppStore } from "../store/useAppStore";

export function WeekStrip() {
  const board = useAppStore((state) => state.board);
  const setBoard = useAppStore((state) => state.setBoard);
  const data = useAppStore((state) => state.data);
  const dragging = useDragStore((state) => Boolean(state.taskId));
  const over = useDragStore((state) => state.over);
  const days = weekDays();
  const todayKey = dateKey(new Date());

  const countFor = (target: Board) => {
    if (!data) return 0;
    if (target === "week") return data.placements.length;
    return data.placements.filter((placement) => placement.board === target).length;
  };

  const dropRing = (target: Board) =>
    dragging && over?.kind === "board" && over.board === target
      ? "ring-2 ring-emerald-400/70 ring-offset-1 ring-offset-[var(--panel-2)]"
      : "";

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {days.map((day) => {
        const active = board === day.board;
        const count = countFor(day.board);
        const isPast = day.dateKey < todayKey;
        return (
          <button
            key={day.board}
            type="button"
            data-drop-board={isPast ? undefined : day.board}
            title={
              isPast
                ? `${day.short} 已过去，不能投放（会顺延到今天）`
                : `拖到这里 = 承诺到${day.short}`
            }
            onClick={() => setBoard(day.board)}
            className={[
              "group flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
              active
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : isPast
                  ? "border-transparent text-[var(--t4)] hover:bg-[var(--hover)]"
                  : "border-transparent text-[var(--t3)] hover:border-[var(--line)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
              dropRing(day.board),
            ].join(" ")}
          >
            <span className="font-medium">{day.short}</span>
            <span className="text-[10px] text-[var(--t3)]">
              {day.date.getMonth() + 1}/{day.date.getDate()}
            </span>
            {day.isToday ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
            {count > 0 ? (
              <span className="rounded-full bg-[var(--hover-strong)] px-1.5 text-[10px] text-[var(--t3)]">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        data-drop-board="week"
        title="拖到这里 = 承诺到周图"
        onClick={() => setBoard("week")}
        className={[
          "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors",
          board === "week"
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border-transparent text-[var(--t3)] hover:border-[var(--line)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
          dropRing("week"),
        ].join(" ")}
      >
        <span className="font-medium">周</span>
        <span className="text-[10px] text-[var(--t3)]">全景</span>
        {countFor("week") > 0 ? (
          <span className="rounded-full bg-[var(--hover-strong)] px-1.5 text-[10px] text-[var(--t3)]">
            {countFor("week")}
          </span>
        ) : null}
      </button>
      <span className="ml-1 hidden shrink-0 text-[10px] text-[var(--t4)] xl:inline">
        {BOARD_LABEL[board]} · 不翻周
      </span>
    </div>
  );
}
