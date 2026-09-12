import { useRef, type FC, type RefObject } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { WaveformMetadata } from "../types";
import type { Section } from "../../../lib/waveform";
import { useLoopCarets } from "./useLoopCarets";
import { usePlayheadCaret } from "./usePlayheadCaret";
import { useTrackbarZoom } from "./useTrackbarZoom";
import { useAnimateTrackbar } from "./useAnimateTrackbar";
import { useLoopHandleDrag } from "./useLoopHandleDrag";
import { useLoopPillDrag } from "./useLoopPillDrag";
import { usePlayheadDrag } from "./usePlayheadDrag";

const HANDLE_SHADOW = { filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.05))" };

const caretBtn =
  "btn-surface absolute top-1/2 -translate-y-1/2 h-7 w-6 rounded-md items-center justify-center text-icon-muted z-10";

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

  const {
    leftCaretRef,
    rightCaretRef,
    applyCaretVisibility,
    onLeftCaretClick,
    onRightCaretClick,
  } = useLoopCarets(metadata, totalSamples, handleRange);

  const {
    leftCaretRef: leftPlayheadCaretRef,
    rightCaretRef: rightPlayheadCaretRef,
    applyPlayheadCaretVisibility,
    onLeftCaretClick: onLeftPlayheadCaretClick,
    onRightCaretClick: onRightPlayheadCaretClick,
  } = usePlayheadCaret(
    metadata,
    totalSamples,
    sampleRate,
    positionMS,
    handleRange,
  );

  useAnimateTrackbar(
    { trackRef, pillRef, leftHandleRef, rightHandleRef, playheadRef },
    metadata,
    positionMS,
    sampleRate,
    applyCaretVisibility,
    applyPlayheadCaretVisibility,
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

  useTrackbarZoom(rootRef, metadata, totalSamples, handleRange);

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
    <div
      ref={rootRef}
      className="w-full shrink-0 z-10 pt-1 flex flex-col gap-1 touch-none"
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
        <button
          ref={leftCaretRef}
          type="button"
          data-trackbar-control
          aria-label="Scroll to loop start"
          onClick={onLeftCaretClick}
          className={`${caretBtn} left-0`}
          style={{ display: "none" }}
        >
          <CaretLeftIcon size={14} weight="bold" />
        </button>
        <button
          ref={rightCaretRef}
          type="button"
          data-trackbar-control
          aria-label="Scroll to loop end"
          onClick={onRightCaretClick}
          className={`${caretBtn} right-0`}
          style={{ display: "none" }}
        >
          <CaretRightIcon size={14} weight="bold" />
        </button>
      </div>
      {/* playhead row */}
      <div className="w-full h-7 relative">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-5 rounded-sm bg-surface border border-neutral-100 pointer-events-none" />
        <div
          ref={playheadRef}
          data-trackbar-control
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 flex items-center justify-center cursor-ew-resize touch-none z-10"
          {...playheadDragProps}
        >
          <div className="size-3 rotate-45 rounded-sm bg-play border border-black/20 [box-shadow:var(--shadow-inset-active)]" />
        </div>
        <button
          ref={leftPlayheadCaretRef}
          type="button"
          data-trackbar-control
          aria-label="Scroll to playhead"
          onClick={onLeftPlayheadCaretClick}
          className={`${caretBtn} left-0`}
          style={{ display: "none" }}
        >
          <CaretLeftIcon size={14} weight="bold" color="var(--color-play)" />
        </button>
        <button
          ref={rightPlayheadCaretRef}
          type="button"
          data-trackbar-control
          aria-label="Scroll to playhead"
          onClick={onRightPlayheadCaretClick}
          className={`${caretBtn} right-0`}
          style={{ display: "none" }}
        >
          <CaretRightIcon size={14} weight="bold" color="var(--color-play)" />
        </button>
      </div>
    </div>
  );
};
