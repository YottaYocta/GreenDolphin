import { useEffect, useRef, type FC, type RefObject } from "react";
import type { WaveformMetadata } from "./types";
import { computeMS } from "../../lib/util";
import type { Section } from "../../lib/waveform";

const MIN_LOOP_GAP_SAMPLES = 1;

export type TrackbarProps = {
  positionMS?: RefObject<number>;
  sampleRate: number;
  metadata: RefObject<WaveformMetadata>;
  totalSamples: number;
  handleLoopEdit: (section: Section) => void;
  handleLoopEditFinish: (section: Section) => void;
};

export const Trackbar: FC<TrackbarProps> = ({
  positionMS,
  metadata,
  sampleRate,
  totalSamples,
  handleLoopEdit,
  handleLoopEditFinish,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const render = () => {
      const track = trackRef.current;
      if (track) {
        const width = track.clientWidth;
        const { range, section } = metadata.current;
        const rangeLen = range.end - range.start;

        const startPct = ((section.start - range.start) / rangeLen) * 100;
        const endPct = ((section.end - range.start) / rangeLen) * 100;
        const clampedStart = Math.max(0, Math.min(100, startPct));
        const clampedEnd = Math.max(0, Math.min(100, endPct));

        if (pillRef.current) {
          pillRef.current.style.left = `${clampedStart}%`;
          pillRef.current.style.width = `${Math.max(0, clampedEnd - clampedStart)}%`;
        }
        if (leftHandleRef.current) {
          const inView = startPct >= 0 && startPct <= 100;
          leftHandleRef.current.style.display = inView ? "block" : "none";
          leftHandleRef.current.style.left = `${startPct}%`;
        }
        if (rightHandleRef.current) {
          const inView = endPct >= 0 && endPct <= 100;
          rightHandleRef.current.style.display = inView ? "block" : "none";
          rightHandleRef.current.style.left = `${endPct}%`;
        }

        if (playheadRef.current && positionMS) {
          const relativePosition =
            positionMS.current - computeMS(sampleRate, range.start);
          const relativeDuration = computeMS(sampleRate, rangeLen);
          const position = width * (relativePosition / relativeDuration);
          playheadRef.current.style.left = `${position}px`;
        }
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [metadata, positionMS, sampleRate]);

  const pointerToSample = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const { range } = metadata.current;
    const rangeLen = range.end - range.start;
    const frac = (clientX - rect.left) / rect.width;
    return range.start + Math.round(frac * rangeLen);
  };

  const beginHandleDrag = (
    clientX: number,
    side: "start" | "end",
    e: { stopPropagation: () => void; preventDefault: () => void },
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const initial = metadata.current.section;

    let latest: Section = initial;

    const applyAt = (cx: number) => {
      const sample = Math.max(0, Math.min(totalSamples, pointerToSample(cx)));
      const next: Section =
        side === "start"
          ? {
              start: Math.min(sample, initial.end - MIN_LOOP_GAP_SAMPLES),
              end: initial.end,
            }
          : {
              start: initial.start,
              end: Math.max(sample, initial.start + MIN_LOOP_GAP_SAMPLES),
            };
      latest = next;
      handleLoopEdit(next);
    };

    const finish = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      handleLoopEditFinish(latest);
    };

    const onMouseMove = (ev: MouseEvent) => applyAt(ev.clientX);
    const onMouseUp = () => finish();
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches[0]) applyAt(ev.touches[0].clientX);
    };
    const onTouchEnd = () => finish();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    applyAt(clientX);
  };

  const beginPillDrag = (
    clientX: number,
    e: { stopPropagation: () => void; preventDefault: () => void },
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const { range, section } = metadata.current;
    const rangeLen = range.end - range.start;
    const sectionLen = section.end - section.start;
    const startClientX = clientX;
    const initialStart = section.start;

    let latest: Section = section;

    const applyAt = (cx: number) => {
      const dxFrac = (cx - startClientX) / rect.width;
      const dxSamples = Math.round(dxFrac * rangeLen);
      let nextStart = initialStart + dxSamples;
      nextStart = Math.max(0, Math.min(totalSamples - sectionLen, nextStart));
      latest = { start: nextStart, end: nextStart + sectionLen };
      handleLoopEdit(latest);
    };

    const finish = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      handleLoopEditFinish(latest);
    };

    const onMouseMove = (ev: MouseEvent) => applyAt(ev.clientX);
    const onMouseUp = () => finish();
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches[0]) applyAt(ev.touches[0].clientX);
    };
    const onTouchEnd = () => finish();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  };

  return (
    <div className="w-full h-8 shrink-0 border-b border-border z-10">
      <div className="w-full h-full relative" ref={trackRef}>
        <div
          ref={pillRef}
          className="absolute top-1/2 -translate-y-1/2 h-5 bg-surface border border-neutral-100 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => beginPillDrag(e.clientX, e)}
          onTouchStart={(e) => {
            if (e.touches[0]) beginPillDrag(e.touches[0].clientX, e);
          }}
        />
        <div
          ref={leftHandleRef}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex justify-center cursor-ew-resize touch-none"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" }}
          onMouseDown={(e) => beginHandleDrag(e.clientX, "start", e)}
          onTouchStart={(e) => {
            if (e.touches[0])
              beginHandleDrag(e.touches[0].clientX, "start", e);
          }}
        >
          <div className="size-4 rotate-45 rounded-[5px] bg-surface border border-border [box-shadow:var(--shadow-inset)]" />
        </div>
        <div
          ref={rightHandleRef}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex justify-center cursor-ew-resize touch-none"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" }}
          onMouseDown={(e) => beginHandleDrag(e.clientX, "end", e)}
          onTouchStart={(e) => {
            if (e.touches[0]) beginHandleDrag(e.touches[0].clientX, "end", e);
          }}
        >
          <div className="size-4 rotate-45 rounded-[5px] bg-surface border border-border [box-shadow:var(--shadow-inset)]" />
        </div>
        <div
          className="absolute size-3.5 rotate-45 rounded-[4px] bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)] top-2/1 -translate-x-1/2 pointer-events-none"
          ref={playheadRef}
        />
      </div>
    </div>
  );
};
