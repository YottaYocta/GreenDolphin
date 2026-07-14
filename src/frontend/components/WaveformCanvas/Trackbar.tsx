import {
  useEffect,
  useRef,
  type FC,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { WaveformMetadata } from "./types";
import { computeMS } from "../../lib/util";
import type { Section } from "../../lib/waveform";

const MIN_LOOP_GAP_SAMPLES = 1;
const HANDLE_SHADOW = { filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" };

export type TrackbarProps = {
  positionMS?: RefObject<number>;
  sampleRate: number;
  metadata: RefObject<WaveformMetadata>;
  totalSamples: number;
  handleLoopEdit: (section: Section) => void;
  handleLoopEditFinish: (section: Section) => void;
  handlePosition: (sample: number) => void;
};

const beginDrag = (
  onMove: (clientX: number) => void,
  onFinish?: () => void,
) => {
  const finish = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    onFinish?.();
  };
  const onMouseMove = (event: MouseEvent) => onMove(event.clientX);
  const onMouseUp = () => finish();
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches[0]) onMove(event.touches[0].clientX);
  };
  const onTouchEnd = () => finish();
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
};

const dragHandlers = (begin: (clientX: number) => void) => ({
  onMouseDown: (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    begin(e.clientX);
  },
  onTouchStart: (e: ReactTouchEvent) => {
    if (!e.touches[0]) return;
    e.stopPropagation();
    begin(e.touches[0].clientX);
  },
});

export const Trackbar: FC<TrackbarProps> = ({
  positionMS,
  metadata,
  sampleRate,
  totalSamples,
  handleLoopEdit,
  handleLoopEditFinish,
  handlePosition,
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
        const applyHandle = (el: HTMLDivElement | null, pct: number) => {
          if (!el) return;
          const inView = pct >= 0 && pct <= 100;
          el.style.display = inView ? "block" : "none";
          el.style.left = `${pct}%`;
        };
        applyHandle(leftHandleRef.current, startPct);
        applyHandle(rightHandleRef.current, endPct);

        if (playheadRef.current && positionMS) {
          const relativePositionMS =
            positionMS.current - computeMS(sampleRate, range.start);
          const relativeDurationMS = computeMS(sampleRate, rangeLen);
          playheadRef.current.style.left = `${
            width * (relativePositionMS / relativeDurationMS)
          }px`;
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
    return (
      range.start + Math.round(((clientX - rect.left) / rect.width) * rangeLen)
    );
  };

  const clampSample = (s: number) => Math.max(0, Math.min(totalSamples, s));

  const beginHandleDrag = (side: "start" | "end") => {
    const initial = metadata.current.section;
    let latest: Section = initial;
    beginDrag(
      (clientX) => {
        const sample = clampSample(pointerToSample(clientX));
        latest =
          side === "start"
            ? {
                start: Math.min(sample, initial.end - MIN_LOOP_GAP_SAMPLES),
                end: initial.end,
              }
            : {
                start: initial.start,
                end: Math.max(sample, initial.start + MIN_LOOP_GAP_SAMPLES),
              };
        handleLoopEdit(latest);
      },
      () => handleLoopEditFinish(latest),
    );
  };

  const beginPlayheadDrag = () => {
    beginDrag((clientX) =>
      handlePosition(clampSample(pointerToSample(clientX))),
    );
  };

  const beginPillDrag = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const { range, section } = metadata.current;
    const rangeLen = range.end - range.start;
    const sectionLen = section.end - section.start;
    const initialStart = section.start;
    let latest: Section = section;
    beginDrag(
      (moveClientX) => {
        const dxSamples = Math.round(
          ((moveClientX - clientX) / rect.width) * rangeLen,
        );
        const nextStart = Math.max(
          0,
          Math.min(totalSamples - sectionLen, initialStart + dxSamples),
        );
        latest = { start: nextStart, end: nextStart + sectionLen };
        handleLoopEdit(latest);
      },
      () => handleLoopEditFinish(latest),
    );
  };

  const loopHandle = (
    ref: RefObject<HTMLDivElement | null>,
    side: "start" | "end",
  ) => (
    <div
      ref={ref}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex justify-center cursor-ew-resize touch-none"
      style={HANDLE_SHADOW}
      {...dragHandlers(() => beginHandleDrag(side))}
    >
      <div className="size-5 rotate-45 rounded-[5px] bg-surface border border-border [box-shadow:var(--shadow-inset)]" />
    </div>
  );

  return (
    <div className="w-full h-8 shrink-0 z-10 pt-1">
      <div className="w-full h-full relative" ref={trackRef}>
        <div
          ref={pillRef}
          className="absolute top-1/2 -translate-y-1/2 h-5 bg-surface border border-neutral-100 cursor-grab active:cursor-grabbing touch-none"
          {...dragHandlers(beginPillDrag)}
        />
        {loopHandle(leftHandleRef, "start")}
        {loopHandle(rightHandleRef, "end")}
        <div
          ref={playheadRef}
          className="absolute size-5 rotate-45 rounded-sm bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)] top-[calc(100%+2px)] -translate-x-1/2 cursor-ew-resize touch-none z-10"
          {...dragHandlers(beginPlayheadDrag)}
        />
      </div>
    </div>
  );
};
