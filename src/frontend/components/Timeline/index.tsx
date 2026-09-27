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
  contentId?: string;
}

const HANDLE_SHADOW = { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" };

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
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const contentShadeRef = useRef<HTMLDivElement | null>(null);
  const bandShadeRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const dragSampleRef = useRef<number | null>(null);

  const refs = useMemo(
    () => ({
      contentRef,
      ticksRef,
      gripRef,
      lineRef,
      contentShadeRef,
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
      style={HANDLE_SHADOW}
      {...handleDragProps(side)}
    >
      <svg width="16" height="12" viewBox="0 0 16 12" className="block mb-1">
        <polygon
          points="8,0.8 15.2,11.2 0.8,11.2"
          fill="var(--color-surface)"
          stroke="#c8c8c8"
          strokeWidth="1"
          strokeLinejoin="round"
        />
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
        className="relative h-6 shrink-0 bg-surface-input border border-border border-b-0 rounded-t-lg overflow-hidden"
      >
        <div ref={ticksRef} className="absolute inset-0 pointer-events-none" />
        <div
          ref={gripRef}
          data-timeline-control
          className="absolute top-0 -translate-x-1/2 z-10 flex items-start justify-center w-8 h-6 cursor-ew-resize touch-none"
          {...gripDragProps}
        >
          <svg width="16" height="12" viewBox="0 0 16 12" className="block mt-1">
            <polygon
              points="0.8,0.8 15.2,0.8 8,11.2"
              fill="var(--color-play)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div
        ref={contentRef}
        className="relative flex-1 min-h-0 border-x border-border overflow-hidden bg-white"
      >
        {children}
        <div
          ref={contentShadeRef}
          className="absolute inset-y-0 bg-black/[0.04] pointer-events-none"
        />
        <div
          ref={lineRef}
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-play pointer-events-none z-10"
        />
      </div>

      <div
        id="timeline-loop"
        ref={bandRef}
        className="relative h-7 shrink-0 bg-surface border border-border border-t-0 rounded-b-lg overflow-hidden"
      >
        <div
          ref={bandShadeRef}
          className="absolute inset-y-0 bg-surface-input pointer-events-none"
        />
        {loopHandle(leftHandleRef, "start")}
        {loopHandle(rightHandleRef, "end")}
      </div>
    </div>
  );
};
