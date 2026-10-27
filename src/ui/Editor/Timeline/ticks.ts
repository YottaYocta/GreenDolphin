import { formatTime } from "../../shared/format";

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const MIN_TICK_PX = 120;

export const tickStep = (viewSeconds: number, widthPx: number) =>
  TICK_STEPS.find((step) => (step * widthPx) / viewSeconds >= MIN_TICK_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];

export function formatTick(seconds: number, step: number) {
  if (step >= 1) return formatTime(Math.round(seconds));
  const tenths = Math.round(seconds * 10);
  return `${formatTime(Math.floor(tenths / 10))}.${tenths % 10}`;
}
