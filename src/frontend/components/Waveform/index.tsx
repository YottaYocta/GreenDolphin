import {
  useCallback,
  useEffect,
  useRef,
  type CanvasHTMLAttributes,
  type FC,
  type RefObject,
} from "react";

import { type Section } from "../../lib/waveform";
import { Timeline } from "../Timeline";
import {
  FULL_LOOP,
  loopToSection,
  sectionToLoop,
  type TimelineState,
} from "../Timeline/types";
import { useAnimateWaveform } from "./useAnimateWaveform";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

interface WaveformCanvasProps {
  waveformData: AudioBuffer;
  positionMS?: RefObject<number>;
  initialViewport?: Section;
  initialSelection?: Section;
  handleRangeChange?: (newRange: Section) => void;
  /** A gesture that will change the loop has started. */
  handleLoopEditStart?: () => void;
  /** The loop under the frame, in samples, after a gesture ends. */
  handleSelection?: (selection: Section) => void;
  handlePosition?: (position: number) => void;
}

export const Waveform: FC<
  WaveformCanvasProps & CanvasHTMLAttributes<HTMLCanvasElement>
> = ({
  waveformData,
  positionMS,
  initialViewport,
  initialSelection,
  handleRangeChange,
  handleLoopEditStart,
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullRange = { start: 0, end: waveformData.length };
  const stateRef = useRef<TimelineState>({
    viewport: initialViewport ?? fullRange,
    loop: initialSelection
      ? sectionToLoop(initialViewport ?? fullRange, initialSelection)
      : FULL_LOOP,
  });

  useEffect(() => {
    const viewport = initialViewport ?? {
      start: 0,
      end: waveformData.length,
    };
    stateRef.current = {
      viewport,
      loop: initialSelection
        ? sectionToLoop(viewport, initialSelection)
        : FULL_LOOP,
    };
  }, [waveformData, initialViewport, initialSelection]);

  const handleRange = useCallback(
    (viewport: Section) => {
      stateRef.current = { ...stateRef.current, viewport };
      handleRangeChange?.(viewport);
    },
    [handleRangeChange],
  );

  const handleSetPosition = useCallback(
    (position: number) => handlePosition?.(position),
    [handlePosition],
  );

  const handleLoopCommit = useCallback(
    (selection: Section) => handleSelection?.(selection),
    [handleSelection],
  );

  // Keyboard zoom/scroll is discrete, so the loop is committed right away.
  const handleKeyboardRange = useCallback(
    (viewport: Section) => {
      handleRange(viewport);
      handleLoopCommit(loopToSection(viewport, stateRef.current.loop));
    },
    [handleRange, handleLoopCommit],
  );

  useAnimateWaveform(canvasRef, waveformData, stateRef);
  useKeyboardShortcuts(waveformData, stateRef, handleKeyboardRange);

  return (
    <div className="w-full h-full min-h-0 p-4">
      <Timeline
        stateRef={stateRef}
        totalSamples={waveformData.length}
        sampleRate={waveformData.sampleRate}
        positionMS={positionMS}
        onRangeChange={handleRange}
        onPosition={handleSetPosition}
        onLoopEditStart={handleLoopEditStart}
        onLoopCommit={handleLoopCommit}
      >
        <canvas
          id="waveform-canvas"
          {...props}
          ref={canvasRef}
          draggable="false"
          className="block w-full h-full min-w-0 min-h-0 select-none pixelated"
        />
      </Timeline>
    </div>
  );
};
