import { useRef, type FC, type RefObject } from "react";
import type { WaveformMetadata } from "../types";
import type { Section } from "../../../lib/waveform";
import { useAnimateTrackbar } from "./useAnimateTrackbar";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { useLoopPillDrag } from "./useLoopPillDrag";
import { usePlayheadDrag } from "./usePlayheadDrag";
import { useViewportGestures } from "../useViewportGestures";

const HANDLE_SHADOW = { filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" };

const EDGE_FADE_MASK =
  "[mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)] [mask-repeat:no-repeat]";

const timeLabel =
  "pointer-events-none absolute top-1/2 -translate-y-1/2 z-20 rounded bg-white/85 px-1.5 py-0.5 font-space-mono text-xs text-black/60 tabular-nums opacity-0 transition-opacity duration-200";

export type TrackbarProps = {
  positionMS?: RefObject<number>;
  sampleRate: number;
  metadata: RefObject<WaveformMetadata>;
  totalSamples: number;
  handleLoopEdit: (section: Section) => void;
  handleLoopEditFinish: (section: Section) => void;
  handlePosition: (sample: number) => void;
  handleRange: (range: Section) => void;
};

export const Trackbar: FC<TrackbarProps> = ({
  positionMS,
  metadata,
  sampleRate,
  totalSamples,
  handleLoopEdit,
  handleLoopEditFinish,
  handlePosition,
  handleRange,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const playheadTrackRef = useRef<HTMLDivElement | null>(null);
  const playheadDragSampleRef = useRef<number | null>(null);
  const startLabelRef = useRef<HTMLDivElement | null>(null);
  const endLabelRef = useRef<HTMLDivElement | null>(null);

  useAnimateTrackbar(
    {
      trackRef,
      pillRef,
      leftHandleRef,
      rightHandleRef,
      playheadRef,
      playheadTrackRef,
      playheadDragSampleRef,
      startLabelRef,
      endLabelRef,
    },
    metadata,
    positionMS,
    sampleRate,
    totalSamples,
  );

  const handleDragProps = useLoopHandleDrag(
    trackRef,
    metadata,
    totalSamples,
    handleLoopEdit,
    handleLoopEditFinish,
  );
  const pillDragProps = useLoopPillDrag(
    trackRef,
    metadata,
    totalSamples,
    handleLoopEdit,
    handleLoopEditFinish,
  );
  const playheadDragProps = usePlayheadDrag(
    trackRef,
    metadata,
    totalSamples,
    handlePosition,
    playheadDragSampleRef,
  );

  useViewportGestures(rootRef, metadata, totalSamples, handleRange);

  const loopHandle = (
    ref: RefObject<HTMLDivElement | null>,
    side: "start" | "end",
  ) => (
    <div
      ref={ref}
      data-trackbar-control
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-7 h-10 cursor-ew-resize touch-none"
      style={HANDLE_SHADOW}
      {...handleDragProps(side)}
    >
      <svg width="14" height="20" viewBox="0 0 14 20" className="block">
        <polygon
          points="0.75,0.75 13.25,0.75 13.25,12.2 7,19.1 0.75,12.2"
          fill="var(--color-surface)"
          stroke="#d7d7d7"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  return (
    <div className={`-mx-4 px-4 shrink-0 ${EDGE_FADE_MASK}`}>
      <div
        ref={rootRef}
        className="relative w-full z-10 pt-1 flex flex-col touch-none"
      >
        <div
          className="w-full h-7 relative translate-y-1.5"
          ref={trackRef}
          id="trackbar"
        >
          <div
            ref={pillRef}
            data-trackbar-control
            className="absolute top-1/2 -translate-y-1/2 h-10 flex items-center cursor-grab active:cursor-grabbing touch-none"
            {...pillDragProps}
          >
            <div className="w-full h-3 rounded-sm bg-surface border border-neutral-100" />
          </div>
          {loopHandle(leftHandleRef, "start")}
          {loopHandle(rightHandleRef, "end")}
        </div>
        <div
          data-trackbar-control
          className="w-full h-7 relative cursor-ew-resize touch-none"
          id="trackbar-playhead"
          {...playheadDragProps}
        >
          <div
            ref={playheadTrackRef}
            className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm bg-surface border border-neutral-100 pointer-events-none"
          />
          <div
            ref={playheadRef}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="size-3 rotate-45 rounded-sm bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)]" />
          </div>
        </div>
        <div ref={startLabelRef} className={`${timeLabel} left-1`} />
        <div ref={endLabelRef} className={`${timeLabel} right-1`} />
      </div>
    </div>
  );
};
