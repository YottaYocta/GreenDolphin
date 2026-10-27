const NOTE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#ef4444", "#14b8a6"];

export function noteColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return NOTE_COLORS[h % NOTE_COLORS.length];
}

export const stripExt = (name: string) => name.replace(/\.[^./\\]+$/, "");

export function relativeDate(ts: number, now = Date.now()) {
  const days = Math.floor((now - ts) / 86_400_000);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 7) return `Added ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "Added 1 week ago" : `Added ${weeks} weeks ago`;
  return `Added ${new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export const formatSize = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;

export function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const MIN_TICK_PX = 120;

export const tickStep = (viewSeconds: number, widthPx: number) =>
  TICK_STEPS.find((step) => (step * widthPx) / viewSeconds >= MIN_TICK_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];

export function formatTick(seconds: number, step: number) {
  if (step >= 1) return formatTime(Math.round(seconds));
  const tenths = Math.round(seconds * 10);
  return `${formatTime(Math.floor(tenths / 10))}.${tenths % 10}`;
}
