import { formatSeconds } from "../../lib/util";

const STEPS_S = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const MIN_TICK_PX = 120;

export const pickTickStep = (viewportSeconds: number, widthPx: number) => {
  const pxPerSecond = widthPx / viewportSeconds;
  return (
    STEPS_S.find((step) => step * pxPerSecond >= MIN_TICK_PX) ??
    STEPS_S[STEPS_S.length - 1]
  );
};

export const formatTick = (seconds: number, step: number) => {
  if (step >= 1) return formatSeconds(Math.round(seconds));
  const whole = Math.floor(seconds);
  return `${formatSeconds(whole)}.${Math.round((seconds - whole) * 10) % 10}`;
};
