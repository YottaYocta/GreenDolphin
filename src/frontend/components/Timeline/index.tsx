import { useCallback, useRef, type FC, type ReactNode, type RefObject } from "react";
import type { Section } from "../../lib/waveform";
import { pointerToFraction } from "./dragUtils";
import { useAnimateTimeline } from "./useAnimateTimeline";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { useLoopShiftDrag } from "./useLoopShiftDrag";
import { usePlayheadGrip } from "./usePlayheadGrip";
import { useViewportGestures } from "./useViewportGestures";
import { fractionToSample, loopToSection, type TimelineState } from "./types";

export interface TimelineProps {
  stateRef: RefObject<TimelineState>;
  totalSamples: number;
  sampleRate: number;
  positionMS: RefObject<number>;
  /** Viewport changed (pan / zoom). Caller stores it in `stateRef`. */
  onRangeChange: (viewport: Section) => void;
  /** Tap or playhead-grip release. */
  onPosition: (sample: number) => void;
  /**
   * `undefined` when a loop gesture (pan, zoom, handle) starts so playback
   * runs free; the loop under the frame when it ends.
   */
  onLoopChange: (loop: Section | undefined) => void;
  /** Mirror the ruler's tick lines through the content area. */
  gridLines?: boolean;
  /** Content between the ruler and the loop band (waveform, etc). */
  children?: ReactNode;
}

/** Horizontal inset so a triangle at 0% / 100% is fully inside the frame. */
const FRAME_PAD = "px-4";
const ROW = `relative h-7 shrink-0 bg-surface rounded-lg overflow-hidden ${FRAME_PAD}`;

const Triangle: FC<{ points: string; fill: string }> = ({ points, fill }) => (
  <svg width="16" height="22" viewBox="0 0 16 22" className="block">
    <polygon points={points} fill={fill} />
  </svg>
);

export const Timeline: FC<TimelineProps> = ({
  stateRef,
  totalSamples,
  sampleRate,
  positionMS,
  onRangeChange,
  onPosition,
  onLoopChange,
  gridLines = false,
  children,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const refs = useAnimateTimeline(stateRef, positionMS, sampleRate);
  const { contentRef } = refs;

  const liftLoop = useCallback(() => onLoopChange(undefined), [onLoopChange]);
  const commitLoop = useCallback(() => {
    const { viewport, loop } = stateRef.current;
    onLoopChange(loopToSection(viewport, loop));
  }, [stateRef, onLoopChange]);

  const handleTap = useCallback(
    (clientX: number) => {
      const el = contentRef.current;
      if (el)
        onPosition(
          fractionToSample(stateRef.current.viewport, pointerToFraction(clientX, el)),
        );
    },
    [contentRef, stateRef, onPosition],
  );

  useViewportGestures(
    rootRef,
    contentRef,
    stateRef,
    totalSamples,
    onRangeChange,
    handleTap,
    liftLoop,
    commitLoop,
  );
  const handleDragProps = useLoopHandleDrag(bandRef, stateRef, liftLoop, commitLoop);
  const shiftDragProps = useLoopShiftDrag(bandRef, stateRef, liftLoop, commitLoop);
  const gripDragProps = usePlayheadGrip(contentRef, stateRef, refs.dragSampleRef, onPosition);

  const loopHandle = (ref: RefObject<HTMLDivElement | null>, side: "start" | "end") => (
    <div
      ref={ref}
      data-timeline-control
      className="absolute bottom-0 -translate-x-1/2 z-10 flex items-end justify-center w-9 h-full cursor-ew-resize touch-none"
      {...handleDragProps(side)}
    >
      <Triangle points="8,0 16,22 0,22" fill="var(--color-neutral-2)" />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col w-full flex-1 min-h-0 select-none touch-none"
    >
      <div id="timeline-ruler" className={ROW}>
        <div className="relative w-full h-full">
          <div ref={refs.ticksRef} className="absolute inset-0 pointer-events-none" />
          <div
            ref={refs.gripRef}
            data-timeline-control
            className="absolute top-0 -translate-x-1/2 z-10 flex items-start justify-center w-9 h-7 cursor-ew-resize touch-none"
            {...gripDragProps}
          >
            <Triangle points="0,0 16,0 8,22" fill="var(--color-play)" />
          </div>
        </div>
      </div>

      <div className={`relative flex-1 min-h-0 flex flex-col overflow-hidden bg-white ${FRAME_PAD}`}>
        <div ref={contentRef} className="relative w-full flex-1 min-h-0 flex flex-col">
          {gridLines && (
            <div ref={refs.contentTicksRef} className="absolute inset-0 pointer-events-none" />
          )}
          {children}
          <div
            ref={refs.loopStartLineRef}
            className="absolute inset-y-0 w-px bg-black/12 pointer-events-none"
          />
          <div
            ref={refs.loopEndLineRef}
            className="absolute inset-y-0 w-px -translate-x-full bg-black/12 pointer-events-none"
          />
          <div
            ref={refs.lineRef}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-play pointer-events-none z-10"
          />
        </div>
      </div>

      <div id="timeline-loop" className={ROW}>
        <div ref={bandRef} className="relative w-full h-full">
          <div
            ref={refs.bandShadeRef}
            data-timeline-control
            className="absolute inset-y-0 bg-surface-active flex items-center justify-center gap-[3px] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
            {...shiftDragProps}
          >
            <div ref={refs.loopGripRef} className="flex gap-[3px]">
              <span className="w-px h-2 bg-black/25" />
              <span className="w-px h-2 bg-black/25" />
              <span className="w-px h-2 bg-black/25" />
            </div>
          </div>
          {loopHandle(refs.leftHandleRef, "start")}
          {loopHandle(refs.rightHandleRef, "end")}
        </div>
      </div>
    </div>
  );
};
