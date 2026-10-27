import type { DurationSeconds, Section } from "../../../core";

export interface LoopFraction {
  start: number;
  end: number;
}

export const FULL: LoopFraction = { start: 0, end: 1 };
export const MIN_LOOP = 0.01;
export const MIN_VIEW = 0.005;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const length = (s: Section) => s.end - s.start;

export function fit(s: Section, bounds: Section): Section {
  const len = Math.min(length(s), length(bounds));
  const start = clamp(s.start, bounds.start, bounds.end - len);
  return { start, end: start + len };
}

export const at = (view: Section, fraction: number) => view.start + fraction * length(view);

export const toSection = (view: Section, loop: LoopFraction): Section => ({
  start: at(view, loop.start),
  end: at(view, loop.end),
});

export function toFraction(view: Section, s: Section): LoopFraction {
  const f = (t: number) => clamp((t - view.start) / length(view), 0, 1);
  return { start: f(s.start), end: Math.max(f(s.end), f(s.start) + MIN_LOOP) };
}

export const isFull = (loop: LoopFraction) => loop.start <= 0 && loop.end >= 1;

export function rescale(from: Section, to: Section, loop: LoopFraction): LoopFraction {
  if (isFull(loop) || Math.abs(length(from) - length(to)) < 1e-9) return loop;
  const f = (x: number) => clamp((at(from, x) - to.start) / length(to), 0, 1);
  const start = Math.min(f(loop.start), 1 - MIN_LOOP);
  return { start, end: Math.max(f(loop.end), start + MIN_LOOP) };
}

export function zoom(view: Section, anchorFraction: number, factor: number, duration: DurationSeconds): Section {
  const len = clamp(length(view) * factor, duration * MIN_VIEW, duration);
  const pivot = at(view, anchorFraction);
  return fit({ start: pivot - anchorFraction * len, end: pivot + (1 - anchorFraction) * len }, { start: 0, end: duration });
}

export const pan = (view: Section, delta: DurationSeconds, duration: DurationSeconds): Section =>
  fit({ start: view.start + delta, end: view.end + delta }, { start: 0, end: duration });

export function resizeLoop(loop: LoopFraction, side: "start" | "end", f: number): LoopFraction {
  return side === "start"
    ? { start: clamp(f, 0, loop.end - MIN_LOOP), end: loop.end }
    : { start: loop.start, end: clamp(f, loop.start + MIN_LOOP, 1) };
}

export function shiftLoop(loop: LoopFraction, delta: number): LoopFraction {
  const len = loop.end - loop.start;
  const start = clamp(loop.start + delta, 0, 1 - len);
  return { start, end: start + len };
}
