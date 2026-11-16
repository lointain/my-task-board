import {
  Archive,
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
import { ArchiveDrawer } from "./components/ArchiveDrawer";
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
import { BOARD_LABEL, BOARDS } from "./lib/board";
import { clientToChartPoint } from "./lib/chartGeometry";
import { registerDropHandler } from "./lib/drag";
import { matchesFilter } from "./lib/filter";
import { redo, undo } from "./lib/history";
import { localeFromSettings, setLocale, t, translateError } from "./lib/i18n";
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
  const locale = localeFromSettings(settings);
  // 渲染子组件之前切换当前语言（模块级）
  setLocale(locale);
  const setSetting = useAppStore((state) => state.setSetting);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);

  // 快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z、Ctrl+Y 重做；1–7 周一到周日，8 周图，0 或 W 也切周图
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      const mod = event.metaKey || event.ctrlKey;

      if (mod && !event.altKey) {
        if (event.key.toLowerCase() === "z") {
          if (editing) return; // 交给输入框 / TipTap 的原生撤销
          event.preventDefault();
          const direction = event.shiftKey ? t("已重做：{label}") : t("已撤销：{label}");
          void (event.shiftKey ? redo() : undo()).then((label) => {
            if (label !== null) useAppStore.getState().notify(t(direction, { label }));
          });
          return;
        }
        if (event.key.toLowerCase() === "y") {
          if (editing) return;
          event.preventDefault();
          void redo().then((label) => {
            if (label !== null) {
              useAppStore.getState().notify(t("已重做：{label}", { label }));
            }
          });
          return;
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (editing) return;
      if (event.key >= "1" && event.key <= "8") {
        const next = BOARDS[Number(event.key) - 1];
        if (next) {
          event.preventDefault();
          useAppStore.getState().setBoard(next);
        }
        return;
      }
      if (event.key === "0" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        useAppStore.getState().setBoard("week");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const clearError = useAppStore((state) => state.clearError);
  const load = useAppStore((state) => state.load);
  const reload = useAppStore((state) => state.reload);
  const board = useAppStore((state) => state.board);
  const filters = useAppStore((state) => state.filtersByBoard[state.board]);
  const toast = useAppStore((state) => state.toast);
  const selectedId = useAppStore((state) => state.selectedId);
  const taskTags = useAppStore((state) => state.taskTags);
  const select = useAppStore((state) => state.select);
  const setBoard = useAppStore((state) => state.setBoard);
  const focusInTree = useAppStore((state) => state.focusInTree);
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [momentumTaskId, setMomentumTaskId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sampleIds, setSampleIds] = useState<string[]>([]);
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

  // P4：空库时一键铺一份示例数据，可再一键清掉
  const seedSample = async () => {
    const target = useAppStore.getState().board;
    const seeds = [
      { title: t("示例：设计数据模型"), x: 78, y: 82 },
      { title: t("示例：写周报"), x: 62, y: 34 },
      { title: t("示例：回复邮件"), x: 30, y: 46 },
    ];
    const ids: string[] = [];
    for (const seed of seeds) {
      const created = await createTask({ title: seed.title });
      if (!created) continue;
      ids.push(created.id);
      await placeTaskOn(target, seed.x, seed.y, created.id);
    }
    setSampleIds(ids);
  };

  const clearSample = async () => {
    for (const id of sampleIds) await deleteTask(id);
    setSampleIds([]);
  };

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
        label: t("详情"),
        onClick: () => setDetailId(menuTask.id),
      },
      {
        label: t("在树中编辑"),
        onClick: () => focusInTree(menuTask.id),
      },
      {
        label: t("新建子任务"),
        icon: Plus,
        onClick: () => {
          void createTask({ title: t("新任务"), parentId: menuTask.id });
          focusInTree(menuTask.id);
        },
      },
      {
        label: menuTask.status === "doing" ? t("暂停处理") : t("开始处理"),
        onClick: () =>
          void updateTask(menuTask.id, { status: menuTask.status === "doing" ? "todo" : "doing" }),
      },
    ];
    if (menuPlacement) {
      items.push({
        label: t("动量 / 截止日期"),
        icon: CalendarDays,
        onClick: () => setMomentumTaskId(menuTask.id),
      });
      items.push({
        label: t("从图上移除"),
        onClick: () => void removePlacement(menuTask.id),
      });
    }
    items.push({
      label: t("删除"),
      danger: true,
      onClick: () => {
        if (window.confirm(t("删除「{title}」及其子任务？", { title: menuTask.title }))) {
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
        {t("正在加载本地数据…")}
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
            <div className="text-[10px] text-[var(--t3)]">{t("local-first · 承诺图")}</div>
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
            <Plus size={13} /> {t("项目")}
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
          >
            <BarChart3 size={13} /> {t("周统计")}
          </button>
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--t3)] hover:text-[var(--t1)]"
            title={t("已完成 / 已归档")}
            aria-label={t("已完成 / 已归档")}
          >
            <Archive size={14} />
          </button>
          <button
            type="button"
            onClick={() => void setSetting("theme", theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--t3)] hover:text-[var(--t1)]"
            title={theme === "dark" ? t("切换到浅色") : t("切换到深色")}
            aria-label={theme === "dark" ? t("切换到浅色") : t("切换到深色")}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--t3)] hover:text-[var(--t1)]"
            title={t("设置")}
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
                {t("{board}承诺图", { board: BOARD_LABEL[board] })}
              </h1>
              <span className="text-[10px] text-[var(--t3)]">
                {board === "week" ? t("日板聚合 + 周级承诺") : t("拖点调整 · 右键动量")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--t3)]">
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5">
                {t("{n} 承诺", { n: chartPlacements.length })}
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
              onRemovePlacement={(taskId) => void removePlacement(taskId)}
              sampleActive={sampleIds.length > 0}
              onSeedSample={() => void seedSample()}
              onClearSample={() => void clearSample()}
            />
          </section>

          <div className="flex items-center gap-3 px-1 text-[10px] text-[var(--t3)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q1)]" /> {t("Q1 立即")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q2)]" /> {t("Q2 安排")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q3)]" /> {t("Q3 限时")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--q4)]" /> {t("Q4 删/归档")}
            </span>
            <span className="ml-auto text-[var(--t4)]">
              颜色 = {data?.settings.color_by === "project" ? t("项目") : t("标签组")} ·{" "}
              {t("拖拽 / 右键 / 双击")}
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
          {t("SQLite · WAL · 本地")}
        </span>
        <span className="text-[var(--t5)]">|</span>
        <span>Tauri 2 · React 19 · D3 · TipTap</span>
        <span className="ml-auto flex items-center gap-1 text-[var(--t4)]">
          <ListTree size={11} /> {t("拖动树节点到左侧图 = 承诺")}
        </span>
      </footer>

      <TaskDetailModal task={detailTask} onClose={() => setDetailId(null)} />
      <ArchiveDrawer
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onOpenDetail={(id) => {
          setArchiveOpen(false);
          setDetailId(id);
        }}
      />
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

      {toast ? (
        <div className="pointer-events-none fixed bottom-12 left-1/2 z-[65] -translate-x-1/2 rounded-lg border border-[var(--line-strong,var(--line))] bg-[var(--panel)] px-3.5 py-2 text-[11px] text-[var(--t1)] shadow-xl">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="fixed bottom-12 left-1/2 z-[70] flex max-w-[80vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-red-400/30 bg-red-950/90 px-4 py-2.5 text-[11px] text-red-100 shadow-xl">
          <span className="min-w-0 flex-1">{translateError(error)}</span>
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
