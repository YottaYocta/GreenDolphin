import type { Section } from "../../lib/waveform";
import { clamp } from "../../lib/util";

/** Loop expressed as fractions (0..1) of the current viewport. */
export interface LoopFraction {
  start: number;
  end: number;
}

export interface TimelineState {
  /** Visible range, in samples. */
  viewport: Section;
  /** Loop as a fraction of the viewport: fixed on pan, scales with zoom. */
  loop: LoopFraction;
}

export const FULL_LOOP: LoopFraction = { start: 0, end: 1 };
export const MIN_LOOP_FRACTION = 0.01;

export const fractionToSample = (viewport: Section, f: number) =>
  Math.round(viewport.start + f * (viewport.end - viewport.start));

export const loopToSection = (
  viewport: Section,
  loop: LoopFraction,
): Section => ({
  start: fractionToSample(viewport, loop.start),
  end: fractionToSample(viewport, loop.end),
});

export const sectionToLoop = (
  viewport: Section,
  section: Section,
): LoopFraction => {
  const len = viewport.end - viewport.start;
  return {
    start: clamp((section.start - viewport.start) / len, 0, 1),
    end: clamp((section.end - viewport.start) / len, 0, 1),
  };
};

/** Re-map a loop from one viewport to another, capped to the new frame. */
export const rescaleLoop = (
  from: Section,
  to: Section,
  loop: LoopFraction,
): LoopFraction => {
  const scale = (from.end - from.start) / (to.end - to.start);
  const offset = (from.start - to.start) / (to.end - to.start);
  const start = Math.min(clamp(offset + loop.start * scale, 0, 1), 1 - MIN_LOOP_FRACTION);
  return {
    start,
    end: Math.max(clamp(offset + loop.end * scale, 0, 1), start + MIN_LOOP_FRACTION),
  };
};
