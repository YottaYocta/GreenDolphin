const STEPS_S = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const MIN_TICK_PX = 56;

export const pickTickStep = (viewportSeconds: number, widthPx: number) => {
  const pxPerSecond = widthPx / viewportSeconds;
  return (
    STEPS_S.find((step) => step * pxPerSecond >= MIN_TICK_PX) ??
    STEPS_S[STEPS_S.length - 1]
  );
};

export const formatTick = (seconds: number, step: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (step < 1) {
    const whole = Math.floor(s);
    const tenths = Math.round((s - whole) * 10) % 10;
    return `${m}:${String(whole).padStart(2, "0")}.${tenths}`;
  }
  return `${m}:${String(Math.round(s)).padStart(2, "0")}`;
};
