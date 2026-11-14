import { create } from "zustand";
import type { Board } from "../data/types";
import { DAY_BOARDS } from "./board";

export type DropTarget = { kind: "board"; board: Board } | { kind: "chart" } | null;

interface DragStore {
  taskId: string | null;
  title: string;
  x: number;
  y: number;
  over: DropTarget;
  start: (taskId: string, title: string, x: number, y: number) => void;
  move: (x: number, y: number, over: DropTarget) => void;
  end: () => void;
}

export const useDragStore = create<DragStore>((set) => ({
  taskId: null,
  title: "",
  x: 0,
  y: 0,
  over: null,
  start: (taskId, title, x, y) => set({ taskId, title, x, y, over: null }),
  move: (x, y, over) => set({ x, y, over }),
  end: () => set({ taskId: null, title: "", over: null }),
}));

/** 判断指针下方是不是可投放区域。 */
export function hitTest(x: number, y: number): DropTarget {
  const el = document.elementFromPoint(x, y);
  // 注意：SVG 元素不是 HTMLElement，不能用 instanceof 过滤
  if (!el) return null;

  const boardEl = el.closest("[data-drop-board]");
  if (boardEl instanceof HTMLElement && boardEl.dataset.dropBoard) {
    const board = boardEl.dataset.dropBoard as Board;
    if (board === "week" || DAY_BOARDS.includes(board)) return { kind: "board", board };
  }

  if (el.closest("[data-drop-chart]")) return { kind: "chart" };
  return null;
}

export type DropHandler = (
  taskId: string,
  target: DropTarget,
  clientX: number,
  clientY: number,
) => void;

let dropHandler: DropHandler | null = null;

export function registerDropHandler(handler: DropHandler | null) {
  dropHandler = handler;
}

let lastDragAt = 0;

/** 拖拽刚结束时抑制一次点击，避免误触选中/打开。 */
export function justDragged(): boolean {
  return Date.now() - lastDragAt < 250;
}

const THRESHOLD = 5;

/**
 * 用指针事件实现树节点 → 图/日板的拖拽。
 * 不用 HTML5 DnD，避免 WebView2 里出现禁止光标与 dropEffect 不一致。
 */
export function beginTaskDrag(taskId: string, title: string, startX: number, startY: number) {
  let active = false;
  let finished = false;

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    document.body.classList.remove("task-dragging");
    useDragStore.getState().end();
  };

  const finish = (commit: boolean, clientX: number, clientY: number) => {
    if (finished) return;
    finished = true;
    const target = active && commit ? hitTest(clientX, clientY) : null;
    cleanup();
    if (!active) return;
    lastDragAt = Date.now();
    if (target) dropHandler?.(taskId, target, clientX, clientY);
  };

  const onMove = (event: PointerEvent) => {
    if (!active) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD) return;
      active = true;
      document.body.classList.add("task-dragging");
      useDragStore.getState().start(taskId, title, event.clientX, event.clientY);
    }
    event.preventDefault();
    useDragStore
      .getState()
      .move(event.clientX, event.clientY, hitTest(event.clientX, event.clientY));
  };

  const onUp = (event: PointerEvent) => finish(true, event.clientX, event.clientY);
  const onCancel = (event: PointerEvent) => finish(false, event.clientX, event.clientY);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") finish(false, 0, 0);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
}
