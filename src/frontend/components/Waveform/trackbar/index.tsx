import { useRef, type FC, type RefObject } from "react";
import type { WaveformMetadata } from "../types";
import type { Section } from "../../../lib/waveform";
import { useAnimateTrackbar } from "./useAnimateTrackbar";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { useLoopPillDrag } from "./useLoopPillDrag";
import { usePlayheadDrag } from "./usePlayheadDrag";

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

  useAnimateTrackbar(
    { trackRef, pillRef, leftHandleRef, rightHandleRef, playheadRef },
    metadata,
    positionMS,
    sampleRate,
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

  const loopHandle = (
    ref: RefObject<HTMLDivElement | null>,
    side: "start" | "end",
  ) => (
    <div
      ref={ref}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center size-6 cursor-ew-resize touch-none"
      style={HANDLE_SHADOW}
      {...handleDragProps(side)}
    >
      <div
        className={`w-1.5 h-5 rounded-xs border-y-2 border-neutral-400 ${
          side === "start" ? "border-l-2" : "border-r-2"
        }`}
      />
    </div>
  );

  return (
    <div className="w-full h-8 shrink-0 z-10 pt-1">
      <div className="w-full h-full relative" ref={trackRef} id="trackbar">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 rounded-full bg-surface-track border border-border pointer-events-none" />
        <div
          ref={pillRef}
          className="absolute top-1/2 -translate-y-1/2 h-5 cursor-grab active:cursor-grabbing touch-none"
          {...pillDragProps}
        />
        {loopHandle(leftHandleRef, "start")}
        {loopHandle(rightHandleRef, "end")}
        <div
          ref={playheadRef}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-7 flex items-center justify-center cursor-ew-resize touch-none z-10"
          {...playheadDragProps}
        >
          <div className="size-2.5 rotate-45 rounded-[2px] bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)]" />
        </div>
      </div>
    </div>
  );
};
