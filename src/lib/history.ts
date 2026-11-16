/**
 * 撤销 / 重做：命令栈 + 逆操作。
 *
 * 不做整库快照，只在每个写操作发生时记一条「怎么撤回」。
 * 同类操作在时间窗内合并（比如拖动一串微调，只保留最初的起点）。
 */

export interface HistoryEntry {
  /** 展示给用户的动作名，例如 `移动「设计数据模型」` */
  label: string;
  /** 合并键：相同 key 且在窗口内的连续操作会合并成一步 */
  key?: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const LIMIT = 50;
const MERGE_WINDOW_MS = 600;

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
let lastKey: string | null = null;
let lastAt = 0;

/** 执行 undo/redo 期间置为 true，避免把撤销动作本身再记一遍 */
let replaying = false;

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeHistory(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function historyState() {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.at(-1)?.label ?? null,
    redoLabel: redoStack.at(-1)?.label ?? null,
  };
}

export function recordHistory(entry: HistoryEntry) {
  if (replaying) return;

  const now = Date.now();
  const mergeable =
    entry.key !== undefined && entry.key === lastKey && now - lastAt < MERGE_WINDOW_MS;
  lastKey = entry.key ?? null;
  lastAt = now;

  if (mergeable) {
    const previous = undoStack[undoStack.length - 1];
    if (previous) {
      // 保留最初的 undo，只把 redo 更新成最新状态
      previous.redo = entry.redo;
      previous.label = entry.label;
      redoStack.length = 0;
      emit();
      return;
    }
  }

  undoStack.push(entry);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
  emit();
}

export async function undo(): Promise<string | null> {
  const entry = undoStack.pop();
  if (!entry) return null;
  replaying = true;
  try {
    await entry.undo();
  } finally {
    replaying = false;
  }
  redoStack.push(entry);
  lastKey = null;
  emit();
  return entry.label;
}

export async function redo(): Promise<string | null> {
  const entry = redoStack.pop();
  if (!entry) return null;
  replaying = true;
  try {
    await entry.redo();
  } finally {
    replaying = false;
  }
  undoStack.push(entry);
  lastKey = null;
  emit();
  return entry.label;
}

/** 测试用 */
export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  lastKey = null;
  lastAt = 0;
  redoStack.length = 0;
  emit();
}
