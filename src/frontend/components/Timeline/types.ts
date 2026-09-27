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
  /** Loop as a fixed fraction of the viewport; it never moves on screen. */
  loop: LoopFraction;
}

export const FULL_LOOP: LoopFraction = { start: 0, end: 1 };

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
