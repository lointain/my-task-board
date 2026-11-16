import { create } from "zustand";
import { repo } from "../data/repository";
import type {
  AppData,
  BackupEntry,
  Board,
  FilterState,
  MomentumInput,
  MomentumMode,
  Placement,
  PlacementInput,
  StatsPayload,
  Task,
  TaskPatchInput,
  TaskStatus,
} from "../data/types";
import { EMPTY_FILTER } from "../data/types";
import { BOARDS, boardDateKey, currentBoard, shortTitle } from "../lib/board";
import { clientToChartPoint } from "../lib/chartGeometry";
import { recordHistory } from "../lib/history";
import { t } from "../lib/i18n";

interface AppStore {
  data: AppData | null;
  taskTags: Record<string, string[]>;
  stats: StatsPayload | null;
  board: Board;
  selectedId: string | null;
  /** 请求右侧树把某个节点展开并聚焦（"拆解"= 在树里直接编辑） */
  treeFocus: { id: string; nonce: number } | null;
  filtersByBoard: Record<Board, FilterState>;
  loading: boolean;
  error: string | null;
  /** 一次性提示（撤销结果、拖出图等），3 秒后自动消失 */
  toast: string | null;
  notify: (message: string) => void;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  setBoard: (board: Board) => void;
  select: (id: string | null) => void;
  focusInTree: (id: string) => void;
  setFilter: (board: Board, filter: FilterState) => void;
  resetFilter: (board: Board) => void;
  createTask: (input: {
    title: string;
    parentId?: string | null;
    afterId?: string | null;
  }) => Promise<Task | null>;
  updateTask: (id: string, patch: TaskPatchInput) => Promise<void>;
  completeTask: (id: string, done: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setTags: (taskId: string, tagIds: string[]) => Promise<void>;
  placeTask: (taskId: string, x: number, y: number) => Promise<void>;
  placeTaskOn: (board: Board, x: number, y: number, taskId: string) => Promise<void>;
  placeTaskAtPointer: (taskId: string, clientX: number, clientY: number) => Promise<void>;
  movePlacement: (taskId: string, x: number, y: number) => Promise<void>;
  removePlacement: (taskId: string) => Promise<void>;
  setMomentum: (input: {
    taskId: string;
    dueAt: string | null;
    mode: MomentumMode;
    vx: number;
    vy: number;
  }) => Promise<void>;
  createProject: (title: string, color: string, emoji?: string) => Promise<void>;
  saveTagGroup: (input: {
    id?: string;
    name: string;
    mode: "single" | "multi";
    isFree: boolean;
    color?: string | null;
  }) => Promise<void>;
  deleteTagGroup: (id: string) => Promise<void>;
  saveTag: (input: {
    id?: string;
    groupId: string;
    name: string;
    color?: string | null;
  }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  backup: () => Promise<string | null>;
  listBackups: () => Promise<BackupEntry[]>;
  restoreBackup: (path: string) => Promise<boolean>;
  restartApp: () => Promise<void>;
  clearError: () => void;
}

const TOAST_MS = 3000;
let toastTimer: number | null = null;

const emptyFilters = (): Record<Board, FilterState> => ({
  mon: { ...EMPTY_FILTER },
  tue: { ...EMPTY_FILTER },
  wed: { ...EMPTY_FILTER },
  thu: { ...EMPTY_FILTER },
  fri: { ...EMPTY_FILTER },
  sat: { ...EMPTY_FILTER },
  sun: { ...EMPTY_FILTER },
  week: { ...EMPTY_FILTER },
});

/** P3：每张板的筛选存进 settings，切板 / 重启后都还在 */
const FILTERS_KEY = "filters";

function parseFilters(settings: Record<string, string> | undefined): Record<Board, FilterState> {
  const base = emptyFilters();
  const raw = settings?.[FILTERS_KEY];
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<FilterState> | undefined>;
    for (const board of BOARDS) {
      const item = parsed[board];
      if (!item || typeof item !== "object") continue;
      base[board] = {
        statuses: Array.isArray(item.statuses) ? item.statuses : EMPTY_FILTER.statuses,
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        due: item.due ?? "all",
        text: typeof item.text === "string" ? item.text : "",
      };
    }
  } catch {
    return base;
  }
  return base;
}

function persistFilters(next: Record<Board, FilterState>) {
  void repo.settingsSet(FILTERS_KEY, JSON.stringify(next)).catch((error) => {
    useAppStore.setState({ error: error instanceof Error ? error.message : String(error) });
  });
}

async function fetchAll() {
  const [data, taskTags, stats] = await Promise.all([
    repo.bootstrap(),
    repo.taskTags(),
    repo.statsWeek(),
  ]);
  return { data, taskTags, stats };
}

function placementOf(state: AppStore, taskId: string): Placement | undefined {
  return state.data?.placements.find((placement) => placement.taskId === taskId);
}

/** 撤销提示里显示的名字，空标题时退回「未命名」 */
function nameOf(state: AppStore, taskId: string): string {
  const title = state.data?.tasks.find((task) => task.id === taskId)?.title ?? "";
  return shortTitle(title) || t("未命名");
}

/** 把 placement 的写入包成一对逆操作，供 store 内部复用 */
function placementHistory(
  taskId: string,
  before: Placement | undefined,
  after: PlacementInput,
  label: string,
) {
  return {
    label,
    key: `placement:${taskId}`,
    undo: async () => {
      if (before) {
        await repo.placementUpsert({
          taskId,
          board: before.board,
          scheduledDate: before.scheduledDate,
          x: before.x,
          y: before.y,
        });
      } else {
        await repo.placementRemove(taskId);
      }
      await useAppStore.getState().reload();
    },
    redo: async () => {
      await repo.placementUpsert(after);
      await useAppStore.getState().reload();
    },
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  data: null,
  taskTags: {},
  stats: null,
  board: currentBoard(),
  selectedId: null,
  treeFocus: null,
  filtersByBoard: emptyFilters(),
  loading: true,
  error: null,
  toast: null,

  notify: (message) => {
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = window.setTimeout(() => {
      toastTimer = null;
      set({ toast: null });
    }, TOAST_MS);
  },

  load: async () => {
    set({ loading: true, error: null });
    try {
      const { data, taskTags, stats } = await fetchAll();
      set({
        data,
        taskTags,
        stats,
        loading: false,
        board: currentBoard(),
        filtersByBoard: parseFilters(data.settings),
        selectedId: data.tasks[0]?.id ?? null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  reload: async () => {
    try {
      const { data, taskTags, stats } = await fetchAll();
      set((state) => ({
        data,
        taskTags,
        stats,
        error: null,
        filtersByBoard: parseFilters(data.settings),
        selectedId:
          state.selectedId && data.tasks.some((task) => task.id === state.selectedId)
            ? state.selectedId
            : (data.tasks[0]?.id ?? null),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setBoard: (board) => set({ board }),
  select: (id) => set({ selectedId: id }),
  focusInTree: (id) =>
    set((state) => ({
      selectedId: id,
      treeFocus: { id, nonce: (state.treeFocus?.nonce ?? 0) + 1 },
    })),
  setFilter: (board, filter) => {
    const next = { ...get().filtersByBoard, [board]: filter };
    set({ filtersByBoard: next });
    persistFilters(next);
  },
  resetFilter: (board) => {
    const next = { ...get().filtersByBoard, [board]: { ...EMPTY_FILTER } };
    set({ filtersByBoard: next });
    persistFilters(next);
  },

  createTask: async (input) => {
    try {
      const task = await repo.taskCreate(input);
      await get().reload();
      set({ selectedId: task.id });
      recordHistory({
        label: t("新建「{title}」", { title: nameOf(get(), task.id) }),
        undo: async () => {
          await repo.taskDelete(task.id);
          await get().reload();
        },
        redo: async () => {
          await repo.taskRestore(task.id);
          await get().reload();
        },
      });
      return task;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  updateTask: async (id, patch) => {
    try {
      const task = get().data?.tasks.find((item) => item.id === id);
      const before: TaskPatchInput = {};
      if (patch.title !== undefined) before.title = task?.title;
      if (patch.status !== undefined) before.status = task?.status;
      if (patch.dueAt !== undefined) before.dueAt = task?.dueAt ?? "";
      if (patch.parentId !== undefined) before.parentId = task?.parentId ?? "";
      if (patch.sortOrder !== undefined) before.sortOrder = task?.sortOrder;
      if (patch.noteJson !== undefined) before.noteJson = task?.noteJson ?? "";
      if (patch.noteText !== undefined) before.noteText = task?.noteText ?? "";
      if (patch.color !== undefined) before.color = task?.color ?? "";
      if (patch.emoji !== undefined) before.emoji = task?.emoji ?? "";

      await repo.taskUpdate(id, patch);
      await get().reload();
      recordHistory({
        label: t("修改「{title}」", { title: nameOf(get(), id) }),
        key: `task:${id}:${Object.keys(patch).sort().join(",")}`,
        undo: async () => {
          await repo.taskUpdate(id, before);
          await get().reload();
        },
        redo: async () => {
          await repo.taskUpdate(id, patch);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  completeTask: async (id, done) => {
    try {
      await repo.taskComplete(id, done);
      await get().reload();
      recordHistory({
        label: done
          ? t("完成「{title}」", { title: nameOf(get(), id) })
          : t("取消完成「{title}」", { title: nameOf(get(), id) }),
        key: `complete:${id}`,
        undo: async () => {
          await repo.taskComplete(id, !done);
          await get().reload();
        },
        redo: async () => {
          await repo.taskComplete(id, done);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  deleteTask: async (id) => {
    try {
      const label = t("删除「{title}」", { title: nameOf(get(), id) });
      await repo.taskDelete(id);
      await get().reload();
      recordHistory({
        label,
        undo: async () => {
          await repo.taskRestore(id);
          await get().reload();
        },
        redo: async () => {
          await repo.taskDelete(id);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setTags: async (taskId, tagIds) => {
    try {
      const before = get().taskTags[taskId] ?? [];
      await repo.taskSetTags(taskId, tagIds);
      await get().reload();
      recordHistory({
        label: t("修改标签「{title}」", { title: nameOf(get(), taskId) }),
        key: `tags:${taskId}`,
        undo: async () => {
          await repo.taskSetTags(taskId, before);
          await get().reload();
        },
        redo: async () => {
          await repo.taskSetTags(taskId, tagIds);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  placeTask: async (taskId, x, y) => {
    try {
      const { board } = get();
      const after = { taskId, board, scheduledDate: boardDateKey(board), x, y };
      const before = placementOf(get(), taskId);
      await repo.placementUpsert(after);
      await get().reload();
      recordHistory(
        placementHistory(
          taskId,
          before,
          after,
          t("放到图上「{title}」", { title: nameOf(get(), taskId) }),
        ),
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  placeTaskOn: async (board, x, y, taskId) => {
    try {
      const after = { taskId, board, scheduledDate: boardDateKey(board), x, y };
      const before = placementOf(get(), taskId);
      await repo.placementUpsert(after);
      await get().reload();
      recordHistory(
        placementHistory(
          taskId,
          before,
          after,
          t("放到图上「{title}」", { title: nameOf(get(), taskId) }),
        ),
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  placeTaskAtPointer: async (taskId, clientX, clientY) => {
    try {
      const svg = document.querySelector<SVGSVGElement>("[data-chart-svg]");
      if (!svg) return;
      const point = clientToChartPoint(svg, clientX, clientY);
      const { board } = get();
      const after = {
        taskId,
        board,
        scheduledDate: boardDateKey(board),
        x: point.x,
        y: point.y,
      };
      const before = placementOf(get(), taskId);
      await repo.placementUpsert(after);
      await get().reload();
      recordHistory(
        placementHistory(
          taskId,
          before,
          after,
          t("放到图上「{title}」", { title: nameOf(get(), taskId) }),
        ),
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  movePlacement: async (taskId, x, y) => {
    try {
      const { board, data } = get();
      const existing = data?.placements.find((p) => p.taskId === taskId);
      const after = {
        taskId,
        board,
        scheduledDate: existing?.scheduledDate ?? boardDateKey(board),
        x,
        y,
      };
      await repo.placementUpsert(after);
      await get().reload();
      recordHistory(
        placementHistory(
          taskId,
          existing,
          after,
          t("移动「{title}」", { title: nameOf(get(), taskId) }),
        ),
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  removePlacement: async (taskId) => {
    try {
      const before = placementOf(get(), taskId);
      const label = t("从图上移除「{title}」", { title: nameOf(get(), taskId) });
      await repo.placementRemove(taskId);
      await get().reload();
      recordHistory({
        label,
        key: `placement:${taskId}`,
        undo: async () => {
          if (before) {
            await repo.placementUpsert({
              taskId,
              board: before.board,
              scheduledDate: before.scheduledDate,
              x: before.x,
              y: before.y,
            });
          }
          await get().reload();
        },
        redo: async () => {
          await repo.placementRemove(taskId);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setMomentum: async (input) => {
    try {
      const state = get();
      const before = placementOf(state, input.taskId);
      const beforeInput: MomentumInput | null = before
        ? {
            taskId: input.taskId,
            dueAt: state.data?.tasks.find((t) => t.id === input.taskId)?.dueAt ?? null,
            mode: before.momentumMode,
            vx: before.vx,
            vy: before.vy,
          }
        : null;
      await repo.placementSetMomentum(input);
      await get().reload();
      recordHistory({
        label: t("改动量「{title}」", { title: nameOf(get(), input.taskId) }),
        key: `momentum:${input.taskId}`,
        undo: async () => {
          if (beforeInput) {
            await repo.placementSetMomentum(beforeInput);
            await get().reload();
          }
        },
        redo: async () => {
          await repo.placementSetMomentum(input);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  createProject: async (title, color, emoji) => {
    try {
      if (!title.trim()) return;
      const task = await repo.taskCreate({ title: title.trim(), color, emoji: emoji ?? null });
      await get().reload();
      recordHistory({
        label: t("新建「{title}」", { title: nameOf(get(), task.id) }),
        undo: async () => {
          await repo.taskDelete(task.id);
          await get().reload();
        },
        redo: async () => {
          await repo.taskRestore(task.id);
          await get().reload();
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  saveTagGroup: async (input) => {
    try {
      await repo.tagGroupSave(input);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  deleteTagGroup: async (id) => {
    try {
      await repo.tagGroupDelete(id);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  saveTag: async (input) => {
    try {
      await repo.tagSave(input);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  deleteTag: async (id) => {
    try {
      await repo.tagDelete(id);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setSetting: async (key, value) => {
    try {
      await repo.settingsSet(key, value);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  backup: async () => {
    try {
      return await repo.backupNow();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  listBackups: async () => {
    try {
      return await repo.backupList();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  },

  restoreBackup: async (path) => {
    try {
      await repo.backupRestore(path);
      await get().load();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  restartApp: async () => {
    try {
      await repo.appRestart();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  clearError: () => set({ error: null }),
}));

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return t("待办");
    case "doing":
      return t("进行中");
    case "done":
      return t("已完成");
    case "archived":
      return t("已归档");
  }
}

export function tagsOf(state: AppStore, taskId: string): string[] {
  return state.taskTags[taskId] ?? [];
}

export function groupForTask(state: AppStore, groupId: string) {
  return state.data?.tagGroups.find((group) => group.id === groupId);
}

export function tagsForGroup(state: AppStore, groupId: string) {
  return state.data?.tags.filter((tag) => tag.groupId === groupId) ?? [];
}

export function tagById(state: AppStore, id: string) {
  return state.data?.tags.find((tag) => tag.id === id);
}

export type { AppStore };
