import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Board, TaskStatus } from "../data/types";
import { EMPTY_FILTER } from "../data/types";
import { useAppStore } from "../store/useAppStore";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "待办" },
  { value: "doing", label: "进行中" },
  { value: "done", label: "已完成" },
];

interface FilterBarProps {
  hiddenCount: number;
}

export function FilterBar({ hiddenCount }: FilterBarProps) {
  const board = useAppStore((state) => state.board);
  const filter = useAppStore((state) => state.filtersByBoard[board]);
  const setFilter = useAppStore((state) => state.setFilter);
  const resetFilter = useAppStore((state) => state.resetFilter);
  const data = useAppStore((state) => state.data);

  const update = (patch: Partial<typeof filter>) => setFilter(board, { ...filter, ...patch });
  const tags = data?.tags ?? [];
  const activeCount = (filter.text ? 1 : 0) + (filter.due !== "all" ? 1 : 0) + filter.tagIds.length;

  const toggleStatus = (status: TaskStatus) => {
    update({
      statuses: filter.statuses.includes(status)
        ? filter.statuses.filter((s) => s !== status)
        : [...filter.statuses, status],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs text-[var(--t3)] focus-within:border-emerald-400/40">
        <Search size={13} />
        <input
          value={filter.text}
          onChange={(event) => update({ text: event.target.value })}
          placeholder="筛选标题 / 笔记…"
          className="min-w-0 flex-1 bg-transparent text-[var(--t1)] outline-none placeholder:text-[var(--t4)]"
        />
        {filter.text ? (
          <button type="button" onClick={() => update({ text: "" })} className="text-[var(--t3)]">
            <X size={12} />
          </button>
        ) : null}
      </label>

      <div className="flex h-8 items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {STATUS_OPTIONS.map((option) => {
          const active = filter.statuses.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleStatus(option.value)}
              className={[
                "h-6 rounded-md px-2 text-[11px] transition-colors",
                active
                  ? "bg-[var(--hover-strong)] text-[var(--t1)]"
                  : "text-[var(--t3)] hover:text-[var(--t2)]",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <select
        value={filter.due}
        onChange={(event) => update({ due: event.target.value as typeof filter.due })}
        className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)] outline-none"
      >
        <option value="all">截止：全部</option>
        <option value="overdue">截止：逾期</option>
        <option value="today">截止：今天</option>
        <option value="week">截止：本周</option>
        <option value="none">截止：无</option>
      </select>

      <select
        value={filter.tagIds[0] ?? ""}
        onChange={(event) => update({ tagIds: event.target.value ? [event.target.value] : [] })}
        className="h-8 max-w-[150px] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)] outline-none"
      >
        <option value="">标签：全部</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => resetFilter(board)}
        className="flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] text-[var(--t3)] hover:text-[var(--t1)]"
        title="清除筛选"
      >
        <SlidersHorizontal size={12} />
        {activeCount > 0 ? `筛选 ${activeCount}` : "筛选"}
      </button>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => resetFilter(board)}
          className="text-[10px] text-[var(--t3)] hover:text-[var(--t2)]"
        >
          已隐藏 {hiddenCount} 个
        </button>
      ) : null}
    </div>
  );
}

export function clearFilter(board: Board) {
  useAppStore.getState().setFilter(board, { ...EMPTY_FILTER });
}
