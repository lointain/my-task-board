export type TaskStatus = "todo" | "doing" | "done" | "archived";
export type Board = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | "week";
export type MomentumMode = "auto" | "manual";

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  recurrence: string | null;
  color: string | null;
  emoji: string | null;
  sortOrder: number;
  noteJson: string | null;
  noteText: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  effectiveDue: string | null;
  dueSource: string | null;
}

export interface Placement {
  id: string;
  taskId: string;
  board: Board;
  scheduledDate: string | null;
  x: number;
  y: number;
  momentumMode: MomentumMode;
  vx: number;
  vy: number;
  momentumUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagGroup {
  id: string;
  name: string;
  mode: "single" | "multi";
  isFree: boolean;
  color: string | null;
  sortOrder: number;
}

export interface Tag {
  id: string;
  groupId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface AppData {
  tasks: Task[];
  placements: Placement[];
  tagGroups: TagGroup[];
  tags: Tag[];
  settings: Record<string, string>;
}

export interface StatsPayload {
  completed: Task[];
  overdue: Task[];
  completedCount: number;
  overdueCount: number;
  dueToday: number;
  dueWeek: number;
  weekStart: string;
  weekEnd: string;
}

export interface FilterState {
  statuses: TaskStatus[];
  tagIds: string[];
  due: "all" | "overdue" | "today" | "week" | "none";
  text: string;
}

export const EMPTY_FILTER: FilterState = {
  statuses: ["todo", "doing"],
  tagIds: [],
  due: "all",
  text: "",
};

export interface TaskCreateInput {
  title: string;
  parentId?: string | null;
  color?: string | null;
  emoji?: string | null;
  afterId?: string | null;
}

export interface TaskPatchInput {
  title?: string;
  status?: TaskStatus;
  dueAt?: string;
  parentId?: string;
  sortOrder?: number;
  noteJson?: string;
  noteText?: string;
  color?: string;
  emoji?: string;
}

export interface PlacementInput {
  taskId: string;
  board: Board;
  scheduledDate: string | null;
  x: number;
  y: number;
}

export interface MomentumInput {
  taskId: string;
  dueAt: string | null;
  mode: MomentumMode;
  vx: number;
  vy: number;
}
