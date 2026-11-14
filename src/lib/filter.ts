import type { FilterState, Task } from "../data/types";
import { dateKey, startOfWeek } from "./board";

export function matchesFilter(
  task: Task,
  filter: FilterState,
  tagIds: string[],
  today = new Date(),
): boolean {
  if (!filter.statuses.includes(task.status)) return false;

  if (filter.text.trim()) {
    const q = filter.text.trim().toLowerCase();
    if (!task.title.toLowerCase().includes(q) && !(task.noteText ?? "").toLowerCase().includes(q)) {
      return false;
    }
  }

  if (filter.tagIds.length > 0 && !filter.tagIds.some((id) => tagIds.includes(id))) {
    return false;
  }

  if (filter.due !== "all") {
    if (filter.due === "none") {
      if (task.effectiveDue) return false;
    } else if (!task.effectiveDue) {
      return false;
    } else {
      const todayKey = dateKey(today);
      if (filter.due === "overdue" && !(task.effectiveDue < todayKey)) return false;
      if (filter.due === "today" && task.effectiveDue !== todayKey) return false;
      if (filter.due === "week") {
        const start = startOfWeek(today);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (task.effectiveDue < dateKey(start) || task.effectiveDue > dateKey(end)) return false;
      }
    }
  }

  return true;
}
