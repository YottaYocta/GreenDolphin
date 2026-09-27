import {
  useCallback,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
  type RefObject,
} from "react";
import type { Section } from "../../lib/waveform";
import { useAnimateTimeline } from "./useAnimateTimeline";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { usePlayheadGrip } from "./usePlayheadGrip";
import { useViewportGestures } from "./useViewportGestures";
import { loopToSection, type TimelineState } from "./types";

export interface TimelineProps {
  stateRef: RefObject<TimelineState>;
  totalSamples: number;
  sampleRate: number;
  positionMS?: RefObject<number>;
  /** Viewport changed (pan / zoom). Caller stores it in `stateRef`. */
  onRangeChange: (viewport: Section) => void;
  /** Tap or playhead-grip release. */
  onPosition: (sample: number) => void;
  /** A pan / zoom / loop-handle gesture began: playback should run free. */
  onLoopEditStart?: () => void;
  /** Gesture ended: apply the loop that is now under the frame. */
  onLoopCommit: (loop: Section) => void;
  /** Content between the ruler and the loop band (waveform, progress bar…). */
  children: ReactNode;
  /** Draw the ruler's tick lines through the content area as well. */
  gridLines?: boolean;
}

/** Horizontal inset so a triangle at 0% / 100% is fully inside the frame. */
const FRAME_PAD = "px-3";

export const Timeline: FC<TimelineProps> = ({
  stateRef,
  totalSamples,
  sampleRate,
  positionMS,
  onRangeChange,
  onPosition,
  onLoopEditStart,
  onLoopCommit,
  children,
  gridLines = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const contentTicksRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const bandShadeRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const dragSampleRef = useRef<number | null>(null);

  const refs = useMemo(
    () => ({
      contentRef,
      ticksRef,
      contentTicksRef,
      gripRef,
      lineRef,
      bandShadeRef,
      leftHandleRef,
      rightHandleRef,
      dragSampleRef,
    }),
    [],
  );
  useAnimateTimeline(refs, stateRef, positionMS, sampleRate);

  const commitLoop = useCallback(() => {
    const { viewport, loop } = stateRef.current;
    onLoopCommit(loopToSection(viewport, loop));
  }, [stateRef, onLoopCommit]);

  const handleTap = useCallback(
    (clientX: number) => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { viewport } = stateRef.current;
      const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onPosition(
        Math.max(
          0,
          Math.min(
            totalSamples,
            Math.round(viewport.start + f * (viewport.end - viewport.start)),
          ),
        ),
      );
    },
    [stateRef, totalSamples, onPosition],
  );

  const gestureCallbacks = useMemo(
    () => ({
      onTap: handleTap,
      onGestureStart: onLoopEditStart,
      onGestureEnd: commitLoop,
    }),
    [handleTap, onLoopEditStart, commitLoop],
  );
  useViewportGestures(
    rootRef,
    stateRef,
    totalSamples,
    onRangeChange,
    gestureCallbacks,
    contentRef,
  );

  const handleDragProps = useLoopHandleDrag(
    bandRef,
    stateRef,
    onLoopEditStart ?? (() => {}),
    commitLoop,
  );
  const gripDragProps = usePlayheadGrip(
    contentRef,
    stateRef,
    dragSampleRef,
    onPosition,
  );

  const loopHandle = (
    ref: RefObject<HTMLDivElement | null>,
    side: "start" | "end",
  ) => (
    <div
      ref={ref}
      data-timeline-control
      className="absolute bottom-0 -translate-x-1/2 z-10 flex items-end justify-center w-9 h-full cursor-ew-resize touch-none"
      {...handleDragProps(side)}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" className="block">
        <polygon points="11,0 22,22 0,22" fill="var(--color-neutral-2)" />
      </svg>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col w-full h-full min-h-0 select-none touch-none"
    >
      <div
        id="timeline-ruler"
        className={`relative h-6 shrink-0 bg-surface border border-border-solid border-b-0 rounded-t-lg overflow-hidden ${FRAME_PAD}`}
      >
        <div className="relative w-full h-full">
          <div
            ref={ticksRef}
            className="absolute inset-0 pointer-events-none"
          />
          <div
            ref={gripRef}
            data-timeline-control
            className="absolute top-0 -translate-x-1/2 z-10 flex items-start justify-center w-9 h-6 cursor-ew-resize touch-none"
            {...gripDragProps}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" className="block">
              <polygon points="0,0 22,0 11,22" fill="var(--color-play)" />
            </svg>
          </div>
        </div>
      </div>

      <div
        className={`relative flex-1 min-h-0 border-x border-border-solid overflow-hidden bg-white ${FRAME_PAD}`}
      >
        <div ref={contentRef} className="relative w-full h-full">
          {gridLines && (
            <div
              ref={contentTicksRef}
              className="absolute inset-0 pointer-events-none"
            />
          )}
          {children}
          <div
            ref={lineRef}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-play pointer-events-none z-10"
          />
        </div>
      </div>

      <div
        id="timeline-loop"
        className={`relative h-7 shrink-0 bg-surface border border-border-solid border-t-0 rounded-b-lg overflow-hidden ${FRAME_PAD}`}
      >
        <div ref={bandRef} className="relative w-full h-full">
          <div
            ref={bandShadeRef}
            className="absolute inset-y-0 bg-surface-active pointer-events-none"
          />
          {loopHandle(leftHandleRef, "start")}
          {loopHandle(rightHandleRef, "end")}
        </div>
      </div>
    </div>
  );
};
