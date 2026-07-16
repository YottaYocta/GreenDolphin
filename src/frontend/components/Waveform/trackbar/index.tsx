import { useRef, type FC, type RefObject } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { WaveformMetadata } from "../types";
import type { Section } from "../../../lib/waveform";
import { useLoopCarets } from "./useLoopCarets";
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);

  const {
    leftCaretRef,
    rightCaretRef,
    applyCaretVisibility,
    onLeftCaretClick,
    onRightCaretClick,
  } = useLoopCarets(metadata, totalSamples, handleRange);

  useAnimateTrackbar(
    { trackRef, pillRef, leftHandleRef, rightHandleRef, playheadRef },
    metadata,
    positionMS,
    sampleRate,
    applyCaretVisibility,
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
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex justify-center cursor-ew-resize touch-none"
      style={HANDLE_SHADOW}
      {...handleDragProps(side)}
    >
      <div className="size-5 rotate-45 rounded-[5px] bg-surface border border-border [box-shadow:var(--shadow-inset)]" />
    </div>
  );

  return (
    <div className="w-full h-8 shrink-0 z-10 pt-1">
      <div className="w-full h-full relative" ref={trackRef} id="trackbar">
        <div
          ref={pillRef}
          className="absolute top-1/2 -translate-y-1/2 h-5 bg-surface border border-neutral-100 cursor-grab active:cursor-grabbing touch-none"
          {...pillDragProps}
        />
        {loopHandle(leftHandleRef, "start")}
        {loopHandle(rightHandleRef, "end")}
        <button
          ref={leftCaretRef}
          type="button"
          aria-label="Scroll to loop start"
          onClick={onLeftCaretClick}
          className="btn-surface absolute top-1/2 -translate-y-1/2 left-0 h-7 w-6 rounded-md items-center justify-center text-icon-muted z-10"
          style={{ display: "none" }}
        >
          <CaretLeftIcon size={14} weight="bold" />
        </button>
        <button
          ref={rightCaretRef}
          type="button"
          aria-label="Scroll to loop end"
          onClick={onRightCaretClick}
          className="btn-surface absolute top-1/2 -translate-y-1/2 right-0 h-7 w-6 rounded-md items-center justify-center text-icon-muted z-10"
          style={{ display: "none" }}
        >
          <CaretRightIcon size={14} weight="bold" />
        </button>
        <div
          ref={playheadRef}
          className="absolute size-5 rotate-45 rounded-sm bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)] top-[calc(100%+2px)] -translate-x-1/2 cursor-ew-resize touch-none z-10"
          {...playheadDragProps}
        />
      </div>
    </div>
  );
};
