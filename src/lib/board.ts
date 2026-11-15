import type { Board, Placement, Tag, TagGroup, Task } from "../data/types";
import { t } from "./i18n";

export const DAY_BOARDS: Board[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const BOARDS: Board[] = [...DAY_BOARDS, "week"];

const RAW_BOARD_LABEL: Record<Board, string> = {
  mon: "周一",
  tue: "周二",
  wed: "周三",
  thu: "周四",
  fri: "周五",
  sat: "周六",
  sun: "周日",
  week: "周",
};

/** 访问时翻译，避免所有调用点都要传 locale */
export const BOARD_LABEL: Record<Board, string> = new Proxy(RAW_BOARD_LABEL, {
  get: (target, key: string) => t(target[key as Board] ?? key),
});

export interface BoardDay {
  board: Board;
  label: string;
  short: string;
  date: Date;
  dateKey: string;
  isToday: boolean;
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function boardForDate(date: Date): Board {
  return DAY_BOARDS[(date.getDay() + 6) % 7];
}

export function weekDays(now = new Date()): BoardDay[] {
  const start = startOfWeek(now);
  return DAY_BOARDS.map((board, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      board,
      label: `${BOARD_LABEL[board]} ${date.getMonth() + 1}/${date.getDate()}`,
      short: BOARD_LABEL[board],
      date,
      dateKey: dateKey(date),
      isToday: dateKey(date) === dateKey(now),
    };
  });
}

export function currentBoard(now = new Date()): Board {
  return boardForDate(now);
}

export function boardDateKey(board: Board, now = new Date()): string | null {
  if (board === "week") return null;
  const day = weekDays(now).find((d) => d.board === board);
  return day?.dateKey ?? null;
}

export function hslForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 58%)`;
}

export function rootOf(taskId: string, tasks: Map<string, Task>): Task | undefined {
  let current = tasks.get(taskId);
  const guard = new Set<string>();
  while (current?.parentId && !guard.has(current.id)) {
    guard.add(current.id);
    const parent = tasks.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function projectColor(task: Task | undefined): string {
  if (!task) return "#64748b";
  if (task.color) return task.color;
  return hslForId(task.id);
}

export function colorForTask(
  task: Task | undefined,
  tasks: Map<string, Task>,
  tagIds: string[],
  tags: Tag[],
  settings: Record<string, string>,
): string {
  if (!task) return "#64748b";
  const colorBy = settings.color_by ?? "project";
  if (colorBy === "project") {
    return projectColor(rootOf(task.id, tasks));
  }
  const groupTags = tags.filter((tag) => tag.groupId === colorBy && tagIds.includes(tag.id));
  return groupTags[0]?.color ?? projectColor(rootOf(task.id, tasks));
}

export function buildChildren(tasks: Task[]): Map<string | null, Task[]> {
  const map = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const key = task.parentId;
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  return map;
}

export function descendants(taskId: string, children: Map<string | null, Task[]>): Task[] {
  const out: Task[] = [];
  const walk = (id: string) => {
    for (const child of children.get(id) ?? []) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(taskId);
  return out;
}

export function placementBoardLabel(placement: Placement | undefined): string {
  if (!placement) return "";
  return placement.board === "week" ? t("周") : BOARD_LABEL[placement.board];
}

export function placementsForBoard(placements: Placement[], board: Board): Placement[] {
  if (board === "week") return placements;
  return placements.filter((placement) => placement.board === board);
}

export function isOverdue(task: Task, today = dateKey(new Date())): boolean {
  return Boolean(
    task.effectiveDue &&
      task.effectiveDue < today &&
      task.status !== "done" &&
      task.status !== "archived",
  );
}

export function dueLabel(task: Task): string | null {
  if (!task.effectiveDue) return null;
  const today = dateKey(new Date());
  if (task.effectiveDue === today) return t("今天");
  if (task.effectiveDue < today) return t("逾期 {date}", { date: task.effectiveDue.slice(5) });
  return task.effectiveDue.slice(5);
}

export function shortTitle(title: string, max = 16): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

export function groupColor(group: TagGroup): string {
  return group.color ?? hslForId(group.id);
}
