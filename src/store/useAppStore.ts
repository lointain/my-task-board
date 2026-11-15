import { create } from "zustand";
import { repo } from "../data/repository";
import type {
  AppData,
  Board,
  FilterState,
  MomentumMode,
  StatsPayload,
  Task,
  TaskStatus,
} from "../data/types";
import { EMPTY_FILTER } from "../data/types";
import { boardDateKey, currentBoard } from "../lib/board";
import { clientToChartPoint } from "../lib/chartGeometry";

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
  updateTask: (id: string, patch: Parameters<typeof repo.taskUpdate>[1]) => Promise<void>;
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
  clearError: () => void;
}

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

async function fetchAll() {
  const [data, taskTags, stats] = await Promise.all([
    repo.bootstrap(),
    repo.taskTags(),
    repo.statsWeek(),
  ]);
  return { data, taskTags, stats };
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
  setFilter: (board, filter) =>
    set((state) => ({ filtersByBoard: { ...state.filtersByBoard, [board]: filter } })),
  resetFilter: (board) =>
    set((state) => ({
      filtersByBoard: { ...state.filtersByBoard, [board]: { ...EMPTY_FILTER } },
    })),

  createTask: async (input) => {
    try {
      const task = await repo.taskCreate(input);
      await get().reload();
      set({ selectedId: task.id });
      return task;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  updateTask: async (id, patch) => {
    try {
      await repo.taskUpdate(id, patch);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  completeTask: async (id, done) => {
    try {
      await repo.taskComplete(id, done);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  deleteTask: async (id) => {
    try {
      await repo.taskDelete(id);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setTags: async (taskId, tagIds) => {
    try {
      await repo.taskSetTags(taskId, tagIds);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  placeTask: async (taskId, x, y) => {
    try {
      const { board } = get();
      await repo.placementUpsert({
        taskId,
        board,
        scheduledDate: boardDateKey(board),
        x,
        y,
      });
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  placeTaskOn: async (board, x, y, taskId) => {
    try {
      await repo.placementUpsert({
        taskId,
        board,
        scheduledDate: boardDateKey(board),
        x,
        y,
      });
      await get().reload();
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
      await repo.placementUpsert({
        taskId,
        board,
        scheduledDate: boardDateKey(board),
        x: point.x,
        y: point.y,
      });
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  movePlacement: async (taskId, x, y) => {
    try {
      const { board, data } = get();
      const existing = data?.placements.find((p) => p.taskId === taskId);
      await repo.placementUpsert({
        taskId,
        board,
        scheduledDate: existing?.scheduledDate ?? boardDateKey(board),
        x,
        y,
      });
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  removePlacement: async (taskId) => {
    try {
      await repo.placementRemove(taskId);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setMomentum: async (input) => {
    try {
      await repo.placementSetMomentum(input);
      await get().reload();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  createProject: async (title, color, emoji) => {
    try {
      if (!title.trim()) return;
      await repo.taskCreate({ title: title.trim(), color, emoji: emoji ?? null });
      await get().reload();
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

  clearError: () => set({ error: null }),
}));

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "待办";
    case "doing":
      return "进行中";
    case "done":
      return "已完成";
    case "archived":
      return "已归档";
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
