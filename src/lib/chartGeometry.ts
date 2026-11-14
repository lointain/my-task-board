export const CHART = {
  WIDTH: 880,
  HEIGHT: 620,
  MARGIN: { top: 34, right: 34, bottom: 56, left: 64 },
};

export const CHART_INNER_W = CHART.WIDTH - CHART.MARGIN.left - CHART.MARGIN.right;
export const CHART_INNER_H = CHART.HEIGHT - CHART.MARGIN.top - CHART.MARGIN.bottom;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 屏幕坐标 → 图的 0–100 坐标（x 轴反向：左侧为最紧迫）。 */
export function clientToChartPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 50, y: 50 };
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const ratioX = (point.x - CHART.MARGIN.left) / CHART_INNER_W;
  const x = (1 - ratioX) * 100;
  const y = 100 - ((point.y - CHART.MARGIN.top) / CHART_INNER_H) * 100;
  return { x: clamp(Math.round(x), 0, 100), y: clamp(Math.round(y), 0, 100) };
}

/** 紧迫度 → 图内像素 x（100 在最左）。 */
export function urgencyToPixel(x: number): number {
  return CHART_INNER_W * (1 - x / 100);
}

/** 图内像素 x → 紧迫度。 */
export function pixelToUrgency(px: number): number {
  return clamp(((CHART_INNER_W - px) / CHART_INNER_W) * 100, 0, 100);
}
