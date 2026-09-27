import { useEffect, type RefObject } from "react";
import { computeMS } from "../../lib/util";
import { formatTick, pickTickStep } from "./ticks";
import type { TimelineState } from "./types";

export interface TimelineRefs {
  contentRef: RefObject<HTMLDivElement | null>;
  ticksRef: RefObject<HTMLDivElement | null>;
  /** Optional layer inside the content track for full-height tick lines. */
  contentTicksRef: RefObject<HTMLDivElement | null>;
  /** Optional loop start / end lines drawn through the content track. */
  loopStartLineRef: RefObject<HTMLDivElement | null>;
  loopEndLineRef: RefObject<HTMLDivElement | null>;
  gripRef: RefObject<HTMLDivElement | null>;
  lineRef: RefObject<HTMLDivElement | null>;
  bandShadeRef: RefObject<HTMLDivElement | null>;
  leftHandleRef: RefObject<HTMLDivElement | null>;
  rightHandleRef: RefObject<HTMLDivElement | null>;
  dragSampleRef: RefObject<number | null>;
}

const place = (el: HTMLElement | null, px: number, width: number) => {
  if (!el) return;
  const visible = px >= 0 && px <= width;
  el.style.display = visible ? "" : "none";
  el.style.left = `${px}px`;
};

const span = (el: HTMLElement | null, fromPx: number, toPx: number) => {
  if (!el) return;
  el.style.left = `${fromPx}px`;
  el.style.width = `${Math.max(0, toPx - fromPx)}px`;
};

export const useAnimateTimeline = (
  refs: TimelineRefs,
  stateRef: RefObject<TimelineState>,
  positionMS: RefObject<number> | undefined,
  sampleRate: number,
) => {
  useEffect(() => {
    let rafId: number | null = null;
    let tickKey = "";

    const render = () => {
      const content = refs.contentRef.current;
      if (content) {
        const width = content.clientWidth;
        const { viewport, loop } = stateRef.current;
        const rangeLen = viewport.end - viewport.start;
        const toPx = (sample: number) =>
          ((sample - viewport.start) / rangeLen) * width;

        // Ruler ticks: rebuilt only when the viewport or width changes.
        const key = `${viewport.start}|${viewport.end}|${width}`;
        if (key !== tickKey && refs.ticksRef.current) {
          tickKey = key;
          const viewportS = rangeLen / sampleRate;
          const step = pickTickStep(viewportS, width);
          const startS = viewport.start / sampleRate;
          const endS = viewport.end / sampleRate;
          const first = Math.ceil(startS / step) * step;
          let html = "";
          let lines = "";
          for (let t = first; t <= endS; t += step) {
            const x = ((t - startS) / viewportS) * width;
            const line = `<div class="absolute inset-y-0 w-px bg-border-solid" style="left:${x}px"></div>`;
            lines += line;
            html += `${line}<div class="absolute top-1/2 -translate-y-1/2 font-space-mono text-[9px] leading-none text-black/45 tabular-nums" style="left:${x + 4}px">${formatTick(t, step)}</div>`;
          }
          refs.ticksRef.current.innerHTML = html;
          if (refs.contentTicksRef.current)
            refs.contentTicksRef.current.innerHTML = lines;
        }

        // Loop shading (fractions of the viewport, fixed on screen).
        const loopFrom = loop.start * width;
        const loopTo = loop.end * width;
        span(refs.bandShadeRef.current, loopFrom, loopTo);
        if (refs.loopStartLineRef.current)
          refs.loopStartLineRef.current.style.left = `${loopFrom}px`;
        if (refs.loopEndLineRef.current)
          refs.loopEndLineRef.current.style.left = `${loopTo}px`;
        if (refs.leftHandleRef.current)
          refs.leftHandleRef.current.style.left = `${loopFrom}px`;
        if (refs.rightHandleRef.current)
          refs.rightHandleRef.current.style.left = `${loopTo}px`;

        // Playhead.
        if (positionMS) {
          const dragSample = refs.dragSampleRef.current;
          const px =
            dragSample !== null
              ? toPx(dragSample)
              : (width * (positionMS.current - computeMS(sampleRate, viewport.start))) /
                computeMS(sampleRate, rangeLen);
          place(refs.gripRef.current, px, width);
          place(refs.lineRef.current, px, width);
        }
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [refs, stateRef, positionMS, sampleRate]);
};
