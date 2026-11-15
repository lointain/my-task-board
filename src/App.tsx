import {
  BarChart3,
  CalendarDays,
  ListTree,
  Moon,
  Plus,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { DragGhost } from "./components/DragGhost";
import { FilterBar } from "./components/FilterBar";
import { MomentumModal } from "./components/MomentumModal";
import { ProjectModal } from "./components/ProjectModal";
import { QuadrantChart } from "./components/QuadrantChart";
import { SettingsModal } from "./components/SettingsModal";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { TaskTree } from "./components/TaskTree";
import { WeeklyStatsModal } from "./components/WeeklyStatsModal";
import { WeekStrip } from "./components/WeekStrip";
import { BOARD_LABEL } from "./lib/board";
import { clientToChartPoint } from "./lib/chartGeometry";
import { registerDropHandler } from "./lib/drag";
import { matchesFilter } from "./lib/filter";
import { useAppStore } from "./store/useAppStore";

interface MenuState {
  taskId: string;
  x: number;
  y: number;
  source: "tree" | "chart";
}

export default function App() {
  const data = useAppStore((state) => state.data);
  const settings = data?.settings ?? {};
  const theme = settings.theme === "light" ? "light" : "dark";
  const setSetting = useAppStore((state) => state.setSetting);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const clearError = useAppStore((state) => state.clearError);
  const load = useAppStore((state) => state.load);
  const reload = useAppStore((state) => state.reload);
  const board = useAppStore((state) => state.board);
  const filters = useAppStore((state) => state.filtersByBoard[state.board]);
  const selectedId = useAppStore((state) => state.selectedId);
  const taskTags = useAppStore((state) => state.taskTags);
  const select = useAppStore((state) => state.select);
  const focusInTree = useAppStore((state) => state.focusInTree);
  const setBoard = useAppStore((state) => state.setBoard);
  const placeTaskOn = useAppStore((state) => state.placeTaskOn);
  const movePlacement = useAppStore((state) => state.movePlacement);
  const setMomentum = useAppStore((state) => state.setMomentum);
  const removePlacement = useAppStore((state) => state.removePlacement);
  const createTask = useAppStore((state) => state.createTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const completeTask = useAppStore((state) => state.completeTask);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [momentumTaskId, setMomentumTaskId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const lastDayRef = useRef("");

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    lastDayRef.current = new Date().toDateString();
    const timer = window.setInterval(() => {
      const today = new Date().toDateString();
      if (today !== lastDayRef.current) {
        lastDayRef.current = today;
        void reload();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    registerDropHandler((taskId, target, clientX, clientY) => {
      if (!target) return;
      const svg = document.querySelector<SVGSVGElement>("[data-chart-svg]");
      const sameBoardChart = target.kind === "chart";
      const point =
        svg && (sameBoardChart || target.board === board)
          ? clientToChartPoint(svg, clientX, clientY)
          : { x: 50, y: 50 };
      const targetBoard = target.kind === "board" ? target.board : board;
      void placeTaskOn(targetBoard, point.x, point.y, taskId);
      if (targetBoard !== board) setBoard(targetBoard);
    });
    return () => registerDropHandler(null);
  }, [board, placeTaskOn, setBoard]);

  const taskMap = useMemo(
    () => new Map((data?.tasks ?? []).map((task) => [task.id, task])),
    [data?.tasks],
  );

  const chartPlacements = useMemo(() => {
    const placements = data?.placements ?? [];
    return board === "week" ? placements : placements.filter((p) => p.board === board);
  }, [board, data?.placements]);

  const hiddenCount = useMemo(() => {
    let count = 0;
    for (const placement of chartPlacements) {
      const task = taskMap.get(placement.taskId);
      if (!task || task.status === "done" || task.status === "archived") continue;
      if (!matchesFilter(task, filters, taskTags[task.id] ?? [])) {
        count += 1;
      }
    }
    return count;
  }, [chartPlacements, filters, taskMap, taskTags]);

  const detailTask = detailId ? (taskMap.get(detailId) ?? null) : null;
  const momentumTask = momentumTaskId ? (taskMap.get(momentumTaskId) ?? null) : null;
  const momentumPlacement = momentumTaskId
    ? (data?.placements.find((p) => p.taskId === momentumTaskId) ?? null)
    : null;
  const menuTask = menu ? taskMap.get(menu.taskId) : null;
  const menuPlacement = menu ? data?.placements.find((p) => p.taskId === menu.taskId) : null;

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!menuTask) return [];
    const items: MenuItem[] = [
      {
        label: "详情",
        onClick: () => setDetailId(menuTask.id),
      },
      {
        label: "在树中编辑",
        onClick: () => focusInTree(menuTask.id),
      },
      {
        label: "新建子任务",
        icon: Plus,
        onClick: () => {
          void createTask({ title: "新任务", parentId: menuTask.id });
          focusInTree(menuTask.id);
        },
      },
      {
        label: menuTask.status === "doing" ? "暂停处理" : "开始处理",
        onClick: () =>
          void updateTask(menuTask.id, { status: menuTask.status === "doing" ? "todo" : "doing" }),
      },
    ];
    if (menuPlacement) {
      items.push({
        label: "动量 / 截止日期",
        icon: CalendarDays,
        onClick: () => setMomentumTaskId(menuTask.id),
      });
      items.push({
        label: "从图上移除",
        onClick: () => void removePlacement(menuTask.id),
      });
    }
    items.push({
      label: "删除",
      danger: true,
      onClick: () => {
        if (window.confirm(`删除「${menuTask.title}」及其子任务？`)) {
          void deleteTask(menuTask.id);
        }
      },
    });
    return items;
  }, [createTask, deleteTask, focusInTree, menuPlacement, menuTask, removePlacement, updateTask]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-sm text-[var(--t3)]">
        <Sparkles size={16} className="mr-2 animate-pulse text-accent-300" />
        正在加载本地数据…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--line)] bg-[var(--panel-2)] px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid h-7 w-7 grid-cols-2 gap-[2px]">
            <span className="rounded-[2px] bg-accent-400" />
            <span className="rounded-[2px] bg-red-400" />
            <span className="rounded-[2px] bg-slate-500" />
            <span className="rounded-[2px] bg-amber-400" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">TaskBoard</div>
            <div className="text-[10px] text-[var(--t3)]">local-first · 承诺图</div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <WeekStrip />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setProjectOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-accent-400 px-3 text-[11px] font-medium text-accent-950 hover:bg-accent-300"
          >
            <Plus size={13} /> 项目
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
          >
            <BarChart3 size={13} /> 周统计
          </button>
          <button
            type="button"
            onClick={() => void setSetting("theme", theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--t3)] hover:text-[var(--t1)]"
            title={theme === "dark" ? "切换到浅色" : "切换到深色"}
            aria-label={theme === "dark" ? "切换到浅色" : "切换到深色"}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--t3)] hover:text-[var(--t1)]"
            title="设置"
          >
            <Settings2 size={14} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-[var(--t1)]">
                {BOARD_LABEL[board]}承诺图
              </h1>
              <span className="text-[10px] text-[var(--t3)]">
                {board === "week" ? "日板聚合 + 周级承诺" : "拖点调整 · 右键动量"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--t3)]">
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5">
                {chartPlacements.length} 承诺
              </span>
            </div>
          </div>

          <FilterBar hiddenCount={hiddenCount} />

          <section className="dot-grid relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chart-surface)]">
            <QuadrantChart
              board={board}
              placements={data?.placements ?? []}
              tasks={data?.tasks ?? []}
              taskTags={taskTags}
              tags={data?.tags ?? []}
              settings={data?.settings ?? {}}
              filter={filters}
              selectedId={selectedId}
              onSelect={select}
              onOpenDetail={setDetailId}
              onMove={(taskId, x, y) => void movePlacement(taskId, x, y)}
              onMomentum={(taskId, vx, vy) =>
                void setMomentum({ taskId, dueAt: null, mode: "manual", vx, vy })
              }
              onContextMenu={(taskId, x, y) => setMenu({ taskId, x, y, source: "chart" })}
              onDeselect={() => select(null)}
              onToggleDone={(taskId, done) => void completeTask(taskId, done)}
              onToggleDoing={(taskId) => {
                const current = taskMap.get(taskId);
                void updateTask(taskId, { status: current?.status === "doing" ? "todo" : "doing" });
              }}
              childMode={
                (data?.settings.child_view_mode as "direct" | "breadcrumb" | "tree") ?? "direct"
              }
              theme={theme}
            />
          </section>

          <div className="flex items-center gap-3 px-1 text-[10px] text-[var(--t3)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q1)]" /> Q1 立即
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q2)]" /> Q2 安排
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q3)]" /> Q3 限时
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q4)]" /> Q4 删/归档
            </span>
            <span className="ml-auto text-[var(--t4)]">
              颜色 = {data?.settings.color_by === "project" ? "项目" : "标签组"} · 拖拽 / 右键 /
              双击
            </span>
          </div>
        </main>

        <aside className="flex w-[370px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel-2)]">
          <TaskTree
            onOpenDetail={setDetailId}
            onContextMenu={(task, x, y) => setMenu({ taskId: task.id, x, y, source: "tree" })}
            onNewProject={() => setProjectOpen(true)}
          />
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-[var(--line)] bg-[var(--panel-2)] px-4 text-[10px] text-[var(--t3)]">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          SQLite · WAL · 本地
        </span>
        <span className="text-[var(--t5)]">|</span>
        <span>Tauri 2 · React 19 · D3 · TipTap</span>
        <span className="ml-auto flex items-center gap-1 text-[var(--t4)]">
          <ListTree size={11} /> 拖动树节点到左侧图 = 承诺
        </span>
      </footer>

      <TaskDetailModal task={detailTask} onClose={() => setDetailId(null)} />
      <WeeklyStatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        onOpenTask={(id) => {
          setStatsOpen(false);
          setDetailId(id);
        }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProjectModal open={projectOpen} onClose={() => setProjectOpen(false)} />
      <MomentumModal
        task={momentumTask}
        placement={momentumPlacement}
        onClose={() => setMomentumTaskId(null)}
      />

      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      ) : null}

      <DragGhost />

      {error ? (
        <div className="fixed bottom-12 left-1/2 z-[70] flex max-w-[80vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-red-400/30 bg-red-950/90 px-4 py-2.5 text-[11px] text-red-100 shadow-xl">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="rounded px-2 py-1 text-red-200 hover:bg-[var(--hover-strong)]"
          >
            关闭
          </button>
        </div>
      ) : null}
    </div>
  );
}
