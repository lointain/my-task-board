export type QuadrantId = "q1" | "q2" | "q3" | "q4";

export interface QuadrantMeta {
  id: QuadrantId;
  label: string;
  short: string;
  description: string;
  color: string;
}

export const QUADRANTS: Record<QuadrantId, QuadrantMeta> = {
  q1: {
    id: "q1",
    label: "重要且紧急",
    short: "Q1",
    description: "立即处理",
    color: "#f87171",
  },
  q2: {
    id: "q2",
    label: "重要不紧急",
    short: "Q2",
    description: "安排时间",
    color: "#34d399",
  },
  q3: {
    id: "q3",
    label: "紧急不重要",
    short: "Q3",
    description: "委托/限时",
    color: "#fbbf24",
  },
  q4: {
    id: "q4",
    label: "不重要不紧急",
    short: "Q4",
    description: "删除/归档",
    color: "#64748b",
  },
};

/**
 * 象限由连续坐标派生，不单独存储。
 * 分割线默认 50/50，后续可做成可配置。
 */
export function quadrantOf(urgency: number, importance: number): QuadrantId {
  const urgent = urgency >= 50;
  const important = importance >= 50;

  if (important && urgent) return "q1";
  if (important && !urgent) return "q2";
  if (!important && urgent) return "q3";
  return "q4";
}
