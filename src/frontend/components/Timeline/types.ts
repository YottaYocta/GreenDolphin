import type { Section } from "../../lib/waveform";

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

export const loopToSection = (
  viewport: Section,
  loop: LoopFraction,
): Section => {
  const len = viewport.end - viewport.start;
  return {
    start: Math.round(viewport.start + loop.start * len),
    end: Math.round(viewport.start + loop.end * len),
  };
};

export const sectionToLoop = (
  viewport: Section,
  section: Section,
): LoopFraction => {
  const len = viewport.end - viewport.start;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    start: clamp((section.start - viewport.start) / len),
    end: clamp((section.end - viewport.start) / len),
  };
};
