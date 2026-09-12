import { useCallback, useRef, type FC, type RefObject } from "react";
import type { WaveformMetadata } from "../types";
import type { Section } from "../../../lib/waveform";
import { clampSample, pointerToSample } from "./dragUtils";
import { useAnimateTrackbar } from "./useAnimateTrackbar";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { useLoopPillDrag } from "./useLoopPillDrag";
import { usePlayheadDrag } from "./usePlayheadDrag";
import { useTrackbarZoom } from "./useTrackbarZoom";

const HANDLE_SHADOW = { filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" };

// Out-of-range elements overflow into the panel's 16px padding and fade out
// there instead of hard-clipping at the track edge.
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
  );

  // Tap/click on the playhead row moves the playhead there (a "move" upstream)
  const handleTap = useCallback(
    (clientX: number, target: EventTarget | null) => {
      if (
        !(target instanceof Element) ||
        !target.closest("[data-playhead-row]")
      )
        return;
      const track = trackRef.current;
      if (!track) return;
      const sample = pointerToSample(clientX, track, metadata.current.viewport);
      handlePosition(clampSample(sample, totalSamples));
    },
    [metadata, totalSamples, handlePosition],
  );

  useTrackbarZoom(rootRef, metadata, totalSamples, handleRange, handleTap);

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
      <div className="size-3.5 rotate-45 rounded-[4px] bg-surface border border-border [box-shadow:var(--shadow-inset)]" />
    </div>
  );

  return (
    <div className={`-mx-4 px-4 shrink-0 ${EDGE_FADE_MASK}`}>
      <div
        ref={rootRef}
        className="relative w-full z-10 pt-1 flex flex-col gap-1 touch-none"
      >
        {/* loop row */}
        <div className="w-full h-7 relative" ref={trackRef} id="trackbar">
          <div
            ref={pillRef}
            data-trackbar-control
            className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm bg-surface border border-neutral-100 cursor-grab active:cursor-grabbing touch-none"
            {...pillDragProps}
          />
          {loopHandle(leftHandleRef, "start")}
          {loopHandle(rightHandleRef, "end")}
        </div>
        {/* playhead row */}
        <div className="w-full h-7 relative cursor-pointer" data-playhead-row>
          <div
            ref={playheadTrackRef}
            className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm bg-surface border border-neutral-100 pointer-events-none"
          />
          <div
            ref={playheadRef}
            data-trackbar-control
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 flex items-center justify-center cursor-ew-resize touch-none z-10"
            {...playheadDragProps}
          >
            <div className="size-3 rotate-45 rounded-sm bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)]" />
          </div>
        </div>
        {/* transient viewport range labels shown while zooming/panning */}
        <div ref={startLabelRef} className={`${timeLabel} left-1`} />
        <div ref={endLabelRef} className={`${timeLabel} right-1`} />
      </div>
    </div>
  );
};
