import { axisBottom, axisLeft } from "d3-axis";
import { drag } from "d3-drag";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, FilterState, Placement, Tag, Task } from "../data/types";
import { BOARD_LABEL, colorForTask, dateKey, isOverdue, shortTitle } from "../lib/board";
import {
  CHART,
  CHART_INNER_H,
  CHART_INNER_W,
  pixelToUrgency,
  urgencyToPixel,
} from "../lib/chartGeometry";
import { useDragStore } from "../lib/drag";
import { matchesFilter } from "../lib/filter";
import { setLocale, t } from "../lib/i18n";
import { ChartTooltip, type ChildViewMode } from "./ChartTooltip";

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const WIDTH = CHART.WIDTH;
const HEIGHT = CHART.HEIGHT;
const MARGIN = CHART.MARGIN;
const INNER_W = CHART_INNER_W;
const INNER_H = CHART_INNER_H;

// x 轴反向：紧迫度 100 在最左，Q1 因此在左上角
const QUADRANT_STYLE = [
  {
    id: "q2" as const,
    x0: 0,
    x1: 50,
    y0: 50,
    y1: 100,
    label: "Q2 · 重要不紧急",
    color: "#34d399",
  },
  {
    id: "q1" as const,
    x0: 50,
    x1: 100,
    y0: 50,
    y1: 100,
    label: "Q1 · 重要且紧急",
    color: "#f87171",
  },
  { id: "q4" as const, x0: 0, x1: 50, y0: 0, y1: 50, label: "Q4 · 不重要不紧急", color: "#64748b" },
  { id: "q3" as const, x0: 50, x1: 100, y0: 0, y1: 50, label: "Q3 · 紧急不重要", color: "#fbbf24" },
];

interface Entry {
  placement: Placement;
  task: Task;
  tagIds: string[];
  emoji: string | null;
  emojiInherited: boolean;
}

interface QuadrantChartProps {
  board: Board;
  placements: Placement[];
  tasks: Task[];
  taskTags: Record<string, string[]>;
  tags: Tag[];
  settings: Record<string, string>;
  filter: FilterState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onMove: (taskId: string, x: number, y: number) => void;
  onMomentum: (taskId: string, vx: number, vy: number) => void;
  onDeselect: () => void;
  onToggleDone: (taskId: string, done: boolean) => void;
  onToggleDoing: (taskId: string) => void;
  childMode: ChildViewMode;
  theme: "dark" | "light";
  onContextMenu: (taskId: string, x: number, y: number) => void;
  /** A2：Delete 键把点从图上移除（不删任务） */
  onRemovePlacement: (taskId: string) => void;
  /** P4：示例数据 */
  sampleActive: boolean;
  onSeedSample: () => void;
  onClearSample: () => void;
}

export function QuadrantChart({
  board,
  placements,
  tasks,
  taskTags,
  tags,
  settings,
  filter,
  selectedId,
  onSelect,
  onOpenDetail,
  onMove,
  onMomentum,
  onDeselect,
  onToggleDone,
  onToggleDoing,
  childMode,
  theme,
  onContextMenu,
  onRemovePlacement,
  sampleActive,
  onSeedSample,
  onClearSample,
}: QuadrantChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const lastClickRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [hover, setHover] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const childMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.parentId) continue;
      const list = map.get(task.parentId) ?? [];
      list.push(task);
      map.set(task.parentId, list);
    }
    return map;
  }, [tasks]);

  /** emoji：自己有就用，否则取最近祖先（渲染时用 entries 里预先算好的值） */

  const boardPlacements = useMemo(
    () => (board === "week" ? placements : placements.filter((p) => p.board === board)),
    [board, placements],
  );

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    const emojiFor = (task: Task): { emoji: string | null; inherited: boolean } => {
      if (task.emoji) return { emoji: task.emoji, inherited: false };
      let parent = task.parentId ? taskMap.get(task.parentId) : undefined;
      const guard = new Set<string>();
      while (parent && !guard.has(parent.id)) {
        guard.add(parent.id);
        if (parent.emoji) return { emoji: parent.emoji, inherited: true };
        parent = parent.parentId ? taskMap.get(parent.parentId) : undefined;
      }
      return { emoji: null, inherited: false };
    };
    for (const placement of boardPlacements) {
      const task = taskMap.get(placement.taskId);
      if (!task || task.status === "done" || task.status === "archived") continue;
      const ids = taskTags[task.id] ?? [];
      if (!matchesFilter(task, filter, ids)) continue;
      const emoji = emojiFor(task);
      list.push({
        placement,
        task,
        tagIds: ids,
        emoji: emoji.emoji,
        emojiInherited: emoji.inherited,
      });
    }
    return list;
  }, [boardPlacements, taskMap, taskTags, filter]);

  const hiddenCount = useMemo(() => {
    let count = 0;
    for (const placement of boardPlacements) {
      const task = taskMap.get(placement.taskId);
      if (!task || task.status === "done" || task.status === "archived") continue;
      if (!matchesFilter(task, filter, taskTags[task.id] ?? [])) count += 1;
    }
    return count;
  }, [boardPlacements, taskMap, taskTags, filter]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = select(svgEl);
    svg.selectAll("*").remove();

    // 子组件的 effect 先于父组件执行，所以这里自己先把主题写上去再读变量
    document.documentElement.dataset.theme = theme;
    setLocale((settings.locale as "zh-CN" | "en-US") ?? "zh-CN");

    // 主题色：从 CSS 变量读，切换主题时随 settings 变化重绘
    const css = getComputedStyle(document.documentElement);
    const themeColor = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    const colors = {
      bg: themeColor("--chart-bg", "#0e141b"),
      border: themeColor("--chart-border", "#1f2a37"),
      label: themeColor("--chart-label", "#9aa7b7"),
      dotStroke: themeColor("--chart-dot-stroke", "#0b0f14"),
      momentum: themeColor("--chart-momentum", "#94a3b8"),
      handle: themeColor("--chart-handle", "#e2e8f0"),
      ringTrack: themeColor("--chart-ring-track", "rgba(255,255,255,0.12)"),
      text: themeColor("--t1", "#e6edf3"),
    };

    // 反向 x 轴：紧迫度 100 在左、0 在右
    const x = scaleLinear().domain([100, 0]).range([0, INNER_W]);
    const y = scaleLinear().domain([0, 100]).range([INNER_H, 0]);
    const root = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // 点空白处取消选中（点在点上由拖拽逻辑处理）
    svg.on("click", (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("g.chart-point")) return;
      onDeselect();
    });

    root
      .append("rect")
      .attr("class", "chart-bg")
      .attr("width", INNER_W)
      .attr("height", INNER_H)
      .attr("rx", 12)
      .attr("fill", colors.bg)
      .attr("stroke", colors.border);

    root
      .selectAll("rect.quadrant")
      .data(QUADRANT_STYLE)
      .join("rect")
      .attr("x", (d) => Math.min(x(d.x0), x(d.x1)))
      .attr("y", (d) => y(d.y1))
      .attr("width", (d) => Math.abs(x(d.x1) - x(d.x0)))
      .attr("height", (d) => y(d.y0) - y(d.y1))
      .attr("fill", (d) => cssColor(`--${d.id}`, d.color))
      .attr("opacity", 0.05);

    const ticks = [0, 25, 50, 75, 100];
    root
      .append("g")
      .selectAll("line.v")
      .data(ticks)
      .join("line")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", 0)
      .attr("y2", INNER_H)
      .attr("stroke", (d) =>
        d === 50 ? cssColor("--chart-split", "#334155") : cssColor("--chart-grid", "#17212c"),
      )
      .attr("stroke-dasharray", (d) => (d === 50 ? "0" : "3 5"));

    root
      .append("g")
      .selectAll("line.h")
      .data(ticks)
      .join("line")
      .attr("x1", 0)
      .attr("x2", INNER_W)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", (d) =>
        d === 50 ? cssColor("--chart-split", "#334155") : cssColor("--chart-grid", "#17212c"),
      )
      .attr("stroke-dasharray", (d) => (d === 50 ? "0" : "3 5"));

    for (const q of QUADRANT_STYLE) {
      const centerX = (x(q.x0) + x(q.x1)) / 2;
      const left = centerX < INNER_W / 2;
      const top = q.y1 === 100;
      root
        .append("text")
        .attr("x", left ? 14 : INNER_W - 14)
        .attr("y", top ? 24 : INNER_H - 14)
        .attr("text-anchor", left ? "start" : "end")
        .attr("fill", cssColor(`--${q.id}`, q.color))
        .attr("opacity", 0.8)
        .attr("font-size", 11)
        .text(t(q.label));
    }

    const xAxis = axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(10);
    const yAxis = axisLeft(y).tickValues(ticks).tickSize(0).tickPadding(10);

    root
      .append("g")
      .attr("transform", `translate(0,${INNER_H})`)
      .call(xAxis)
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", colors.label)
      .attr("font-size", 10);

    root
      .append("g")
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", colors.label)
      .attr("font-size", 10);

    root
      .append("text")
      .attr("x", INNER_W)
      .attr("y", INNER_H + 38)
      .attr("text-anchor", "end")
      .attr("fill", "#8b98a9")
      .attr("font-size", 11)
      .text(t("← 越靠左越紧迫"));

    root
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -INNER_H)
      .attr("y", -42)
      .attr("text-anchor", "end")
      .attr("fill", "#8b98a9")
      .attr("font-size", 11)
      .text(t("重要性 ↑"));

    const points = root
      .append("g")
      .selectAll<SVGGElement, Entry>("g.chart-point")
      .data(entries, (d) => d.task.id)
      .join("g")
      .attr("class", "chart-point")
      .attr("data-task-id", (d) => d.task.id)
      .attr("transform", (d) => `translate(${x(d.placement.x)},${y(d.placement.y)})`)
      .attr("cursor", "pointer");

    points
      .append("circle")
      .attr("class", "halo")
      .attr("r", 15)
      .attr("fill", (d) => colorForTask(d.task, taskMap, d.tagIds, tags, settings));

    points.attr("aria-label", (d) => {
      const due = d.task.effectiveDue ? t(" · 截止 {date}", { date: d.task.effectiveDue }) : "";
      const day = d.placement.board === "week" ? t("周级") : BOARD_LABEL[d.placement.board];
      return `${d.task.title} · ${day} · ${t("紧迫 {x} / 重要 {y}", {
        x: Math.round(d.placement.x),
        y: Math.round(d.placement.y),
      })}${due}`;
    });

    points
      .filter((d) => isOverdue(d.task, dateKey(new Date())))
      .append("circle")
      .attr("r", 10)
      .attr("fill", "none")
      .attr("stroke", "#f87171")
      .attr("stroke-opacity", 0.85)
      .attr("stroke-dasharray", "2 3");

    // 有 emoji 就不画色点，只留透明命中区 + 图标
    points
      .append("circle")
      .attr("class", "point-dot")
      .attr("r", (d) => (d.emoji ? 8 : 6))
      .attr("fill", (d) =>
        d.emoji ? "transparent" : colorForTask(d.task, taskMap, d.tagIds, tags, settings),
      )
      .attr("stroke", (d) =>
        d.emoji ? "none" : isOverdue(d.task, dateKey(new Date())) ? "#f87171" : colors.dotStroke,
      )
      .attr("stroke-width", 1.5);

    // emoji：自己有就用，没有则取最近祖先
    points
      .filter((d) => Boolean(d.emoji))
      .append("text")
      .attr("class", "point-emoji")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 12)
      .attr("pointer-events", "none")
      .text((d) => d.emoji ?? "");

    // 进度环：仅父节点
    const ringR = 9;
    const ringC = 2 * Math.PI * ringR;
    const progressOf = (task: Task) => {
      const kids = childMap.get(task.id) ?? [];
      if (kids.length === 0) return null;
      const done = kids.filter((kid) => kid.status === "done").length;
      return done / kids.length;
    };

    points
      .filter((d) => progressOf(d.task) !== null)
      .append("circle")
      .attr("class", "ring-track")
      .attr("r", ringR)
      .attr("fill", "none")
      .attr("stroke", colors.ringTrack)
      .attr("stroke-width", 2);

    points
      .filter((d) => progressOf(d.task) !== null)
      .append("circle")
      .attr("class", "ring-arc")
      .attr("r", ringR)
      .attr("fill", "none")
      .attr("stroke", (d) => colorForTask(d.task, taskMap, d.tagIds, tags, settings))
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("transform", "rotate(-90)")
      .attr("stroke-dasharray", (d) => {
        const p = progressOf(d.task) ?? 0;
        return `${Math.max(0.001, p * ringC)} ${ringC}`;
      });

    // 动量：线段 + 每日刻度 + 虚影；逾期：左侧红尾巴
    const showMomentum = settings.show_momentum !== "false";
    const horizon = Number(settings.momentum_horizon_days ?? "7") || 7;
    const pxPerUrgency = INNER_W / 100;
    const pxPerImportance = INNER_H / 100;
    const todayKey = dateKey(new Date());

    const overdueDays = (task: Task) => {
      if (!task.effectiveDue || task.effectiveDue >= todayKey) return 0;
      const a = new Date(`${task.effectiveDue}T00:00:00`).getTime();
      const b = new Date(`${todayKey}T00:00:00`).getTime();
      return Math.max(0, Math.round((b - a) / 86_400_000));
    };

    if (showMomentum) {
      points.each(function (d) {
        const { vx, vy } = d.placement;
        if (Math.hypot(vx, vy) <= 0.0001) return;
        const group = select(this);
        const ex = -vx * horizon * pxPerUrgency;
        const ey = -vy * horizon * pxPerImportance;
        const crossing = d.placement.x < 50 && d.placement.x + vx * horizon >= 50;
        const color = crossing ? "#fbbf24" : colors.momentum;

        group
          .append("line")
          .attr("class", "momentum-line")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", ex)
          .attr("y2", ey)
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.5)
          .attr("pointer-events", "none");

        const len = Math.hypot(ex, ey) || 1;
        const nx = -ey / len;
        const ny = ex / len;
        for (let i = 1; i <= horizon; i += 1) {
          const fx = (ex * i) / horizon;
          const fy = (ey * i) / horizon;
          group
            .append("line")
            .attr("class", "momentum-tick")
            .attr("x1", fx - nx * 2.5)
            .attr("y1", fy - ny * 2.5)
            .attr("x2", fx + nx * 2.5)
            .attr("y2", fy + ny * 2.5)
            .attr("stroke", color)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-width", 1)
            .attr("pointer-events", "none");
        }

        group
          .append("circle")
          .attr("class", "momentum-ghost")
          .attr("cx", ex)
          .attr("cy", ey)
          .attr("r", 4.2)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-opacity", 0.45)
          .attr("stroke-width", 1)
          .attr("pointer-events", "none");
      });

      // 逾期尾巴：往更紧急一侧（像素 x 减小）延伸
      const tails: Array<{ d: Entry; days: number }> = [];
      points.each((d: Entry) => {
        const days = overdueDays(d.task);
        if (days > 0) tails.push({ d, days: Math.min(days, 30) });
      });
      const tailScale = 4; // 1 天 = 4px
      root
        .append("g")
        .selectAll("line")
        .data(tails)
        .join("line")
        .attr("class", "overdue-tail")
        .attr("x1", (t) => x(t.d.placement.x))
        .attr("y1", (t) => y(t.d.placement.y))
        .attr("x2", (t) => Math.max(0, x(t.d.placement.x) - t.days * tailScale))
        .attr("y2", (t) => y(t.d.placement.y))
        .attr("stroke", "#f87171")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.75)
        .attr("pointer-events", "none");

      root
        .append("g")
        .selectAll("text")
        .data(tails)
        .join("text")
        .attr("class", "overdue-label")
        .attr("x", (t) => Math.max(2, x(t.d.placement.x) - t.days * tailScale - 4))
        .attr("y", (t) => y(t.d.placement.y) - 6)
        .attr("text-anchor", "start")
        .attr("fill", "#f87171")
        .attr("font-size", 9)
        .attr("pointer-events", "none")
        .text((tail) => t("逾期 {n}d", { n: tail.days }));
    }

    points
      .append("circle")
      .attr("class", "hover-ring")
      .attr("r", 11)
      .attr("fill", "none")
      .attr("stroke", (d) => colorForTask(d.task, taskMap, d.tagIds, tags, settings))
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1.5)
      .attr("opacity", 0);

    const moveTooltip = (event: MouseEvent, d: Entry) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setHover({
        taskId: d.task.id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    points
      .on("mouseenter", function (event: MouseEvent, d) {
        select(this).select(".hover-ring").attr("opacity", 1);
        moveTooltip(event, d);
      })
      .on("mousemove", (event: MouseEvent, d) => {
        moveTooltip(event, d);
      })
      .on("mouseleave", function () {
        select(this).select(".hover-ring").attr("opacity", 0);
        setHover(null);
      });

    if (entries.length <= 40) {
      points
        .append("text")
        .attr("class", "point-label")
        .attr("x", (d) => (d.placement.x < 18 ? -10 : 10))
        .attr("text-anchor", (d) => (d.placement.x < 18 ? "end" : "start"))
        .attr("y", 4)
        .attr("fill", colors.label)
        .attr("font-size", 10)
        .attr("pointer-events", "none")
        .text((d) => shortTitle(d.task.title, 14));
    }

    points.on("contextmenu", (event, d) => {
      event.preventDefault();
      event.stopPropagation();
      onContextMenu(d.task.id, event.clientX, event.clientY);
    });

    // d3-drag 会在 mouseup 上 preventDefault，浏览器因此不再合成 click/dblclick，
    // 所以“单击/双击”改由 drag 手势自己判定。
    let moved = false;
    let blocked = false;

    const handleTap = (d: Entry) => {
      const now = Date.now();
      const last = lastClickRef.current;
      if (last.id === d.task.id && now - last.at < 450) {
        lastClickRef.current = { id: "", at: 0 };
        onOpenDetail(d.task.id);
        return;
      }
      lastClickRef.current = { id: d.task.id, at: now };
      onSelect(d.task.id);
    };

    // 双击由 handleTap 里的时间窗判定（两次轻点），
    // 不要用 pointerdown 直接开详情：否则“点一下选中、马上拖”会被误判成双击
    const dragBehavior = drag<SVGGElement, Entry>()
      .on("start", function (_event, d) {
        draggingRef.current = true;
        moved = false;
        // 未选中的点不能直接拖动位置：先点一下选中，再拖
        blocked = d.task.id !== selectedIdRef.current;
        setHover(null);
        select(this).raise();
      })
      .on("drag", function (event) {
        if (blocked) return;
        moved = true;
        const nx = Math.max(0, Math.min(INNER_W, event.x));
        const ny = Math.max(0, Math.min(INNER_H, event.y));
        select(this).attr("transform", `translate(${nx},${ny})`);
      })
      .on("end", (event, d) => {
        draggingRef.current = false;
        if (blocked || !moved) {
          handleTap(d);
          return;
        }
        const nx = pixelToUrgency(event.x);
        const ny = Math.max(0, Math.min(100, 100 - (event.y / INNER_H) * 100));
        onMove(d.task.id, Math.round(nx), Math.round(ny));
      });

    points.call(dragBehavior);
    // selectedId 不放进依赖：点击选中不能重建 SVG，否则第二次点击会落在新节点上，双击失效
  }, [
    entries,
    childMap,
    hiddenCount,
    onContextMenu,
    onDeselect,
    onMove,
    onOpenDetail,
    onSelect,
    settings,
    theme,
    tags,
    taskMap,
  ]);

  // 选中后才出现“动量端点”手柄，单独一层，避免选中触发整图重建
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = select(svgEl);
    svg.selectAll(".momentum-handle, .momentum-preview").remove();

    if (!selectedId) return;
    if (settings.show_momentum === "false") return;
    const entry = entries.find((e) => e.task.id === selectedId);
    if (!entry) return;

    const horizon = Number(settings.momentum_horizon_days ?? "7") || 7;
    const pxPerUrgency = INNER_W / 100;
    const pxPerImportance = INNER_H / 100;
    const { vx, vy } = entry.placement;
    const startX = -vx * horizon * pxPerUrgency;
    const startY = -vy * horizon * pxPerImportance;
    const hasVector = Math.hypot(vx, vy) > 0.0001;

    const group = svg
      .selectAll<SVGGElement, Entry>("g.chart-point")
      .filter((d) => d?.task.id === selectedId);
    if (group.empty()) return;

    const preview = group
      .append("line")
      .attr("class", "momentum-preview")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", startX)
      .attr("y2", startY)
      .attr("stroke", cssColor("--chart-handle", "#e2e8f0"))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.3)
      .attr("pointer-events", "none");

    const handle = group
      .append("circle")
      .attr("class", "momentum-handle")
      .attr("cx", startX)
      .attr("cy", startY)
      .attr("r", 4)
      .attr("fill", hasVector ? cssColor("--chart-handle", "#e2e8f0") : "transparent")
      .attr("stroke", cssColor("--chart-handle", "#e2e8f0"))
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", hasVector ? 1 : 0.6)
      .attr("cursor", "crosshair")
      .style("pointer-events", "all");

    let moved = false;
    let lastX = startX;
    let lastY = startY;

    handle.call(
      drag<SVGCircleElement, Entry>()
        .on("start", () => {
          moved = false;
        })
        .on("drag", (event) => {
          moved = true;
          lastX = Math.max(-INNER_W, Math.min(INNER_W, event.x));
          lastY = Math.max(-INNER_H, Math.min(INNER_H, event.y));
          select(handle.node())
            .attr("cx", lastX)
            .attr("cy", lastY)
            .attr("fill", cssColor("--chart-handle", "#e2e8f0"));
          preview.attr("x2", lastX).attr("y2", lastY).attr("opacity", 0.6);
        })
        .on("end", () => {
          if (!moved) return;
          onMomentum(
            entry.task.id,
            Math.max(-5, Math.min(5, Math.round((-lastX / (horizon * pxPerUrgency)) * 100) / 100)),
            Math.max(
              -5,
              Math.min(5, Math.round((-lastY / (horizon * pxPerImportance)) * 100) / 100),
            ),
          );
        }),
    );
  }, [selectedId, entries, settings, onMomentum]);

  // 选中态单独更新
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    select(svgEl)
      .selectAll<SVGGElement, Entry>("g.chart-point")
      .each(function (d) {
        const active = d?.task.id === selectedId;
        const group = select(this);
        group
          .select("circle.point-dot")
          .attr("r", active ? 7.5 : 5.5)
          .attr(
            "stroke",
            active ? cssColor("--t1", "#e6edf3") : cssColor("--chart-dot-stroke", "#0b0f14"),
          )
          .attr("stroke-width", active ? 2 : 1.5);
        group
          .select("text.point-label")
          .attr(
            "fill",
            active ? cssColor("--t1", "#e6edf3") : cssColor("--chart-label", "#9aa7b7"),
          );
      });
  }, [selectedId, entries]);

  const dragging = useDragStore((state) => Boolean(state.taskId));
  const overChart = useDragStore((state) => state.over?.kind === "chart");

  const hovered = hover ? entries.find((entry) => entry.task.id === hover.taskId) : null;

  const selectedEntry = selectedId
    ? (entries.find((entry) => entry.task.id === selectedId) ?? null)
    : null;
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setPanelPos(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const point = container.querySelector(`g.chart-point[data-task-id="${selectedId}"]`);
    if (!point) {
      setPanelPos(null);
      return;
    }
    const rect = point.getBoundingClientRect();
    const base = container.getBoundingClientRect();
    setPanelPos({
      x: rect.left - base.left + rect.width / 2,
      y: rect.top - base.top + rect.height / 2,
    });
  }, [selectedId, entries, size]);

  // A2：键盘微调坐标（连续按键合并成一次写库）
  const pendingRef = useRef<{ taskId: string; x: number; y: number } | null>(null);
  const commitTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    },
    [],
  );

  const queueMove = (current: { taskId: string; x: number; y: number }) => {
    pendingRef.current = current;
    const node = containerRef.current?.querySelector<SVGGElement>(
      `g.chart-point[data-task-id="${current.taskId}"]`,
    );
    node?.setAttribute(
      "transform",
      `translate(${urgencyToPixel(current.x)},${INNER_H * (1 - current.y / 100)})`,
    );
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) onMove(pending.taskId, pending.x, pending.y);
    }, 200);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    if (event.key === "Escape") {
      if (!selectedId) return;
      event.preventDefault();
      onDeselect();
      return;
    }
    if (entries.length === 0) return;

    if (event.key === "Tab") {
      if (!selectedId) return;
      event.preventDefault();
      const index = entries.findIndex((entry) => entry.task.id === selectedId);
      const delta = event.shiftKey ? -1 : 1;
      const next = entries[(index + delta + entries.length) % entries.length];
      if (next) onSelect(next.task.id);
      return;
    }

    const entry = selectedId ? entries.find((item) => item.task.id === selectedId) : null;
    if (!entry) return;

    const step = event.shiftKey ? 5 : 1;
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    const pending = pendingRef.current;
    const from =
      pending && pending.taskId === entry.task.id
        ? { x: pending.x, y: pending.y }
        : { x: entry.placement.x, y: entry.placement.y };

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        queueMove({ taskId: entry.task.id, x: clamp(from.x - step), y: from.y });
        break;
      case "ArrowRight":
        event.preventDefault();
        queueMove({ taskId: entry.task.id, x: clamp(from.x + step), y: from.y });
        break;
      case "ArrowUp":
        event.preventDefault();
        queueMove({ taskId: entry.task.id, x: from.x, y: clamp(from.y + step) });
        break;
      case "ArrowDown":
        event.preventDefault();
        queueMove({ taskId: entry.task.id, x: from.x, y: clamp(from.y - step) });
        break;
      case "Enter":
        event.preventDefault();
        onOpenDetail(entry.task.id);
        break;
      case " ":
        event.preventDefault();
        onToggleDone(entry.task.id, entry.task.status !== "done");
        break;
      case "Delete":
        event.preventDefault();
        onRemovePlacement(entry.task.id);
        break;
      default:
        break;
    }
  };

  const pathOf = (task: Task) => {
    const chain: string[] = [];
    let current: Task | undefined = task;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      chain.unshift(current.title);
      current = current.parentId ? taskMap.get(current.parentId) : undefined;
    }
    return chain;
  };

  const hoveredPath = (() => {
    if (!hovered) return [] as string[];
    const chain: string[] = [];
    let current: Task | undefined = hovered.task;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      chain.unshift(current.title);
      current = current.parentId ? taskMap.get(current.parentId) : undefined;
    }
    return chain;
  })();
  const hoveredTags = hovered
    ? hovered.tagIds
        .map((id) => tags.find((tag) => tag.id === id))
        .filter((tag): tag is Tag => Boolean(tag))
    : [];

  return (
    <div
      ref={containerRef}
      data-drop-chart="true"
      // 图上键盘操作（A2）：区域自己处理方向键 / Enter / Delete，语义上当一块可交互画布
      role="application"
      aria-label={t("重要性紧迫性四象限任务图")}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: 画布要能获得焦点才能接收键盘
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
        containerRef.current?.focus({ preventScroll: true });
      }}
      className={[
        "relative h-full w-full rounded-2xl outline-none transition-shadow",
        dragging && overChart ? "ring-2 ring-accent-400/60" : "",
        dragging && !overChart ? "ring-1 ring-accent-400/20" : "",
      ].join(" ")}
    >
      <svg
        ref={svgRef}
        data-chart-svg="true"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        role="img"
        aria-label={t("重要性紧迫性四象限任务图")}
      />
      {selectedEntry && panelPos ? (
        <ChartTooltip
          task={selectedEntry.task}
          placement={selectedEntry.placement}
          tags={selectedEntry.tagIds
            .map((id) => tags.find((tag) => tag.id === id))
            .filter((tag): tag is Tag => Boolean(tag))}
          path={pathOf(selectedEntry.task)}
          container={size}
          pointer={panelPos}
          interactive
          tasks={tasks}
          childMode={childMode}
          onToggleDone={onToggleDone}
          onToggleDoing={onToggleDoing}
        />
      ) : hovered && hover && !dragging ? (
        <ChartTooltip
          task={hovered.task}
          placement={hovered.placement}
          tags={hoveredTags}
          path={hoveredPath}
          container={size}
          pointer={{ x: hover.x, y: hover.y }}
        />
      ) : null}
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
          <span className="rounded-full border border-accent-400/30 bg-[var(--bg)]/85 px-2.5 py-0.5 text-[10px] text-accent-200">
            {overChart
              ? t("松开：按落点放上去")
              : t("拖到{board}图上松开", { board: BOARD_LABEL[board] })}
          </span>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xl">
            <p className="text-center text-[12px] font-medium text-[var(--t1)]">
              {t("这张图还没有任务")}
            </p>
            <ol className="mt-2 space-y-1 text-[11px] leading-relaxed text-[var(--t3)]">
              <li>{t("① 从右侧任务树拖一个节点进来")}</li>
              <li>{t("② 落点决定象限：越靠左上越重要且紧急")}</li>
              <li>{t("③ 在点上右键可以改动量与截止日")}</li>
            </ol>
            {tasks.length === 0 ? (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={onSeedSample}
                  className="h-7 rounded-md bg-accent-400 px-3 text-[11px] font-medium text-accent-950 hover:bg-accent-300"
                >
                  {t("试试示例数据")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {sampleActive ? (
        <div className="absolute inset-x-0 top-8 flex justify-center">
          <button
            type="button"
            onClick={onClearSample}
            className="rounded-full border border-amber-400/30 bg-[var(--bg)]/90 px-3 py-1 text-[10px] text-amber-200 hover:bg-[var(--hover)]"
          >
            {t("清除示例数据")}
          </button>
        </div>
      ) : null}
      <div className="pointer-events-none absolute right-3 top-2 flex items-center gap-2 text-[10px] text-[var(--t3)]">
        {hiddenCount > 0 ? (
          <span className="rounded-full border border-[var(--line)] bg-[var(--bg)]/80 px-2 py-0.5">
            {t("已隐藏 {n}", { n: hiddenCount })}
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--line)] bg-[var(--bg)]/80 px-2 py-0.5">
          {t("{n} 个承诺", { n: entries.length })}
        </span>
      </div>
    </div>
  );
}
