import { axisBottom, axisLeft } from "d3-axis";
import { drag } from "d3-drag";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { useEffect, useMemo, useRef } from "react";
import type { Board, FilterState, Placement, Tag, Task } from "../data/types";
import { BOARD_LABEL, colorForTask, dateKey, isOverdue, shortTitle } from "../lib/board";
import { matchesFilter } from "../lib/filter";

const WIDTH = 880;
const HEIGHT = 620;
const MARGIN = { top: 34, right: 34, bottom: 56, left: 64 };
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

const QUADRANT_STYLE = [
  { id: "q2" as const, x0: 0, x1: 50, y0: 50, y1: 100, label: "Q2 · 重要不紧急", color: "#34d399" },
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
  onDropTask: (taskId: string, x: number, y: number) => void;
  onContextMenu: (taskId: string, x: number, y: number) => void;
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
  onDropTask,
  onContextMenu,
}: QuadrantChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const boardPlacements = useMemo(
    () => (board === "week" ? placements : placements.filter((p) => p.board === board)),
    [board, placements],
  );

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const placement of boardPlacements) {
      const task = taskMap.get(placement.taskId);
      if (!task || task.status === "done" || task.status === "archived") continue;
      const ids = taskTags[task.id] ?? [];
      if (!matchesFilter(task, filter, ids)) continue;
      list.push({ placement, task, tagIds: ids });
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

    const x = scaleLinear().domain([0, 100]).range([0, INNER_W]);
    const y = scaleLinear().domain([0, 100]).range([INNER_H, 0]);
    const root = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    root
      .append("rect")
      .attr("width", INNER_W)
      .attr("height", INNER_H)
      .attr("rx", 12)
      .attr("fill", "#0e141b")
      .attr("stroke", "#1f2a37");

    root
      .selectAll("rect.quadrant")
      .data(QUADRANT_STYLE)
      .join("rect")
      .attr("x", (d) => x(d.x0))
      .attr("y", (d) => y(d.y1))
      .attr("width", (d) => x(d.x1) - x(d.x0))
      .attr("height", (d) => y(d.y0) - y(d.y1))
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.045);

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
      .attr("stroke", (d) => (d === 50 ? "#334155" : "#17212c"))
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
      .attr("stroke", (d) => (d === 50 ? "#334155" : "#17212c"))
      .attr("stroke-dasharray", (d) => (d === 50 ? "0" : "3 5"));

    for (const q of QUADRANT_STYLE) {
      const left = q.x0 === 0;
      const top = q.y1 === 100;
      root
        .append("text")
        .attr("x", left ? 14 : INNER_W - 14)
        .attr("y", top ? 24 : INNER_H - 14)
        .attr("text-anchor", left ? "start" : "end")
        .attr("fill", q.color)
        .attr("opacity", 0.8)
        .attr("font-size", 11)
        .text(q.label);
    }

    const xAxis = axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(10);
    const yAxis = axisLeft(y).tickValues(ticks).tickSize(0).tickPadding(10);

    root
      .append("g")
      .attr("transform", `translate(0,${INNER_H})`)
      .call(xAxis)
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", 10);

    root
      .append("g")
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", 10);

    root
      .append("text")
      .attr("x", INNER_W)
      .attr("y", INNER_H + 38)
      .attr("text-anchor", "end")
      .attr("fill", "#8b98a9")
      .attr("font-size", 11)
      .text("紧迫性 →");

    root
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -INNER_H)
      .attr("y", -42)
      .attr("text-anchor", "end")
      .attr("fill", "#8b98a9")
      .attr("font-size", 11)
      .text("重要性 ↑");

    if (entries.length === 0) {
      root
        .append("text")
        .attr("x", INNER_W / 2)
        .attr("y", INNER_H / 2 - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#475569")
        .attr("font-size", 13)
        .text("这张图还没有任务");
      root
        .append("text")
        .attr("x", INNER_W / 2)
        .attr("y", INNER_H / 2 + 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#334155")
        .attr("font-size", 11)
        .text("从右侧任务树拖一个节点进来");
    }

    const points = root
      .append("g")
      .selectAll<SVGGElement, Entry>("g.chart-point")
      .data(entries, (d) => d.task.id)
      .join("g")
      .attr("class", "chart-point")
      .attr("transform", (d) => `translate(${x(d.placement.x)},${y(d.placement.y)})`)
      .attr("cursor", "pointer");

    points
      .append("circle")
      .attr("class", "halo")
      .attr("r", 15)
      .attr("fill", (d) => colorForTask(d.task, taskMap, d.tagIds, tags, settings));

    points
      .filter((d) => isOverdue(d.task, dateKey(new Date())))
      .append("circle")
      .attr("r", 10)
      .attr("fill", "none")
      .attr("stroke", "#f87171")
      .attr("stroke-opacity", 0.85)
      .attr("stroke-dasharray", "2 3");

    points
      .append("circle")
      .attr("r", (d) => (d.task.id === selectedId ? 7.5 : 5.5))
      .attr("fill", (d) => colorForTask(d.task, taskMap, d.tagIds, tags, settings))
      .attr("stroke", (d) => (d.task.id === selectedId ? "#e6edf3" : "#0b0f14"))
      .attr("stroke-width", (d) => (d.task.id === selectedId ? 2 : 1.5));

    points.append("title").text((d) => {
      const due = d.task.effectiveDue ? ` · 截止 ${d.task.effectiveDue}` : "";
      const day = d.placement.board === "week" ? "周级" : BOARD_LABEL[d.placement.board];
      return `${d.task.title}\n${day} · 紧迫 ${Math.round(d.placement.x)} / 重要 ${Math.round(
        d.placement.y,
      )}${due}`;
    });

    if (entries.length <= 40) {
      points
        .append("text")
        .attr("x", (d) => (d.placement.x > 82 ? -10 : 10))
        .attr("text-anchor", (d) => (d.placement.x > 82 ? "end" : "start"))
        .attr("y", 4)
        .attr("fill", (d) => (d.task.id === selectedId ? "#e6edf3" : "#9aa7b7"))
        .attr("font-size", 10)
        .attr("pointer-events", "none")
        .text((d) => shortTitle(d.task.title, 14));
    }

    points
      .on("click", (event, d) => {
        event.stopPropagation();
        if (draggingRef.current) return;
        onSelect(d.task.id);
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        onOpenDetail(d.task.id);
      })
      .on("contextmenu", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(d.task.id, event.clientX, event.clientY);
      });

    const dragBehavior = drag<SVGGElement, Entry>()
      .on("start", function () {
        draggingRef.current = true;
        select(this).raise();
      })
      .on("drag", function (event) {
        const nx = Math.max(0, Math.min(INNER_W, event.x));
        const ny = Math.max(0, Math.min(INNER_H, event.y));
        select(this).attr("transform", `translate(${nx},${ny})`);
      })
      .on("end", (event, d) => {
        draggingRef.current = false;
        const nx = Math.max(0, Math.min(100, (event.x / INNER_W) * 100));
        const ny = Math.max(0, Math.min(100, 100 - (event.y / INNER_H) * 100));
        onMove(d.task.id, Math.round(nx), Math.round(ny));
      });

    points.call(dragBehavior);
  }, [
    entries,
    hiddenCount,
    onContextMenu,
    onMove,
    onOpenDetail,
    onSelect,
    selectedId,
    settings,
    tags,
    taskMap,
  ]);

  const handleDrop = (event: React.DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id");
    if (!taskId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    const x = Math.max(0, Math.min(100, ((px - MARGIN.left) / INNER_W) * 100));
    const y = Math.max(0, Math.min(100, 100 - ((py - MARGIN.top) / INNER_H) * 100));
    onDropTask(taskId, Math.round(x), Math.round(y));
  };

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        role="img"
        aria-label="重要性紧迫性四象限任务图"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      />
      <div className="pointer-events-none absolute right-3 top-2 flex items-center gap-2 text-[10px] text-slate-500">
        {hiddenCount > 0 ? (
          <span className="rounded-full border border-[var(--line)] bg-[var(--bg)]/80 px-2 py-0.5">
            已隐藏 {hiddenCount}
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--line)] bg-[var(--bg)]/80 px-2 py-0.5">
          {entries.length} 个承诺
        </span>
      </div>
    </div>
  );
}
