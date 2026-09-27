import { useEffect, useRef, type RefObject } from "react";
import { formatTick, pickTickStep } from "./ticks";
import type { TimelineState } from "./types";

const setLeft = (el: HTMLElement | null, px: number) => {
  if (el) el.style.left = `${px}px`;
};

const place = (el: HTMLElement | null, px: number, width: number) => {
  if (!el) return;
  el.style.display = px >= 0 && px <= width ? "" : "none";
  el.style.left = `${px}px`;
};

/** Creates the DOM refs the timeline positions and drives them from a rAF loop. */
export const useAnimateTimeline = (
  stateRef: RefObject<TimelineState>,
  positionMS: RefObject<number>,
  sampleRate: number,
) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const contentTicksRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const loopStartLineRef = useRef<HTMLDivElement | null>(null);
  const loopEndLineRef = useRef<HTMLDivElement | null>(null);
  const bandShadeRef = useRef<HTMLDivElement | null>(null);
  const loopGripRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const dragSampleRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let tickKey = "";

    const render = () => {
      const content = contentRef.current;
      if (content) {
        const width = content.clientWidth;
        const { viewport, loop } = stateRef.current;
        const rangeLen = viewport.end - viewport.start;
        const toPx = (sample: number) =>
          ((sample - viewport.start) / rangeLen) * width;

        // Ruler ticks: rebuilt only when the viewport or width changes.
        const key = `${viewport.start}|${viewport.end}|${width}`;
        if (key !== tickKey && ticksRef.current) {
          tickKey = key;
          const viewportS = rangeLen / sampleRate;
          const step = pickTickStep(viewportS, width);
          const startS = viewport.start / sampleRate;
          let html = "";
          let lines = "";
          for (let t = Math.ceil(startS / step) * step; t <= viewport.end / sampleRate; t += step) {
            const x = ((t - startS) / viewportS) * width;
            const line = `<div class="absolute inset-y-0 w-px bg-border-solid" style="left:${x}px"></div>`;
            lines += line;
            html += `${line}<div class="absolute top-1/2 -translate-y-1/2 font-space-mono text-[10px] leading-none text-black/30 tabular-nums" style="left:${x + 4}px">${formatTick(t, step)}</div>`;
          }
          ticksRef.current.innerHTML = html;
          if (contentTicksRef.current) contentTicksRef.current.innerHTML = lines;
        }

        // Loop (fractions of the viewport, fixed on screen).
        const loopFrom = loop.start * width;
        const loopTo = loop.end * width;
        const shade = bandShadeRef.current;
        if (shade) {
          shade.style.left = `${loopFrom}px`;
          shade.style.width = `${Math.max(0, loopTo - loopFrom)}px`;
        }
        setLeft(loopStartLineRef.current, loopFrom);
        setLeft(leftHandleRef.current, loopFrom);
        setLeft(loopEndLineRef.current, loopTo);
        setLeft(rightHandleRef.current, loopTo);
        if (loopGripRef.current)
          loopGripRef.current.style.display =
            loop.start <= 0 && loop.end >= 1 ? "none" : "";

        // Playhead (previewed sample while the grip is dragged).
        const px = toPx(
          dragSampleRef.current ?? (positionMS.current / 1000) * sampleRate,
        );
        place(gripRef.current, px, width);
        place(lineRef.current, px, width);
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(rafId);
  }, [stateRef, positionMS, sampleRate]);

  return {
    contentRef,
    ticksRef,
    contentTicksRef,
    gripRef,
    lineRef,
    loopStartLineRef,
    loopEndLineRef,
    bandShadeRef,
    loopGripRef,
    leftHandleRef,
    rightHandleRef,
    dragSampleRef,
  };
};
