import { Keyboard, Plus, Search } from "lucide-react";
import { useState } from "react";
import type { Task } from "../data/types";
import { useAppStore } from "../store/useAppStore";
import { TreeEditor } from "./TreeEditor";

interface TaskTreeProps {
  onOpenDetail: (id: string) => void;
  onContextMenu: (task: Task, x: number, y: number) => void;
  onNewProject: () => void;
}

export function TaskTree({ onOpenDetail, onContextMenu, onNewProject }: TaskTreeProps) {
  const stats = useAppStore((state) => state.stats);
  const selectedId = useAppStore((state) => state.selectedId);
  const select = useAppStore((state) => state.select);
  const createProject = useAppStore((state) => state.createProject);
  const [query, setQuery] = useState("");
  const [dueFilter, setDueFilter] = useState<"today" | "week" | "overdue" | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2.5">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--t3)]">
            任务树
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--t4)]">可直接编辑 · 拖到图上承诺</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHelp((open) => !open)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--t3)] hover:bg-[var(--hover)] hover:text-[var(--t1)]"
            title="快捷键"
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            onClick={onNewProject}
            className="flex h-7 items-center gap-1 rounded-lg bg-accent-400 px-2 text-[11px] font-medium text-accent-950 hover:bg-accent-300"
          >
            <Plus size={12} /> 项目
          </button>
        </div>
      </div>

      {showHelp ? (
        <div className="border-b border-[var(--line-soft)] bg-[var(--panel)] px-3 py-2 text-[10px] leading-relaxed text-[var(--t3)]">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <kbd className="text-accent-300">Enter</kbd>
            <span>在当前节点之后插入（顶层项目则新建子任务）</span>
            <kbd className="text-accent-300">Tab / Shift+Tab</kbd>
            <span>缩进 / 反缩进</span>
            <kbd className="text-accent-300">Alt+↑/↓</kbd>
            <span>同级上下移动</span>
            <kbd className="text-accent-300">↑/↓</kbd>
            <span>切换行</span>
            <kbd className="text-accent-300">Alt+←/→</kbd>
            <span>折叠 / 展开</span>
            <kbd className="text-accent-300">拖动把手</kbd>
            <span>放到图上 = 承诺；放到行上 = 排序/换父级</span>
          </div>
          <button
            type="button"
            onClick={() => void createProject("新项目", "#34d399")}
            className="mt-1.5 text-[10px] text-[var(--t3)] hover:text-[var(--t2)]"
          >
            或直接新建一个项目
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line-soft)] px-3 py-2">
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "today" ? null : "today")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "today"
              ? "bg-amber-400/15 text-amber-200"
              : "text-[var(--t3)] hover:text-[var(--t2)]",
          ].join(" ")}
        >
          今日到期 {stats?.dueToday ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "week" ? null : "week")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "week"
              ? "bg-sky-400/15 text-sky-200"
              : "text-[var(--t3)] hover:text-[var(--t2)]",
          ].join(" ")}
        >
          本周 {stats?.dueWeek ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setDueFilter(dueFilter === "overdue" ? null : "overdue")}
          className={[
            "rounded-md px-2 py-1 text-[10px]",
            dueFilter === "overdue"
              ? "bg-red-400/15 text-red-200"
              : "text-[var(--t3)] hover:text-[var(--t2)]",
          ].join(" ")}
        >
          逾期 {stats?.overdueCount ?? 0}
        </button>
        {dueFilter ? (
          <button
            type="button"
            onClick={() => setDueFilter(null)}
            className="ml-auto text-[10px] text-[var(--t3)] hover:text-[var(--t2)]"
          >
            清除
          </button>
        ) : null}
      </div>

      <div className="border-b border-[var(--line-soft)] px-3 py-2">
        <label className="flex h-7 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t3)] focus-within:border-accent-400/40">
          <Search size={12} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="在树中查找…"
            className="min-w-0 flex-1 bg-transparent text-[var(--t1)] outline-none placeholder:text-[var(--t4)]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        <TreeEditor
          scopeId={null}
          selectedId={selectedId}
          onSelect={select}
          onOpenDetail={onOpenDetail}
          onContextMenu={onContextMenu}
          query={query}
          dueFilter={dueFilter}
        />
      </div>

      <div className="border-t border-[var(--line-soft)] px-3 py-2 text-[10px] text-[var(--t4)]">
        点行内文字直接改 · Enter 新建 · 拖把手到图上承诺
      </div>
    </div>
  );
}
