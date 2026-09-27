import { useCallback, type FC, type RefObject } from "react";
import { type Section } from "../../lib/waveform";
import { Timeline } from "../Timeline";
import { loopToSection } from "../Timeline/types";
import { useTimelineState } from "../Timeline/useTimelineState";
import { useAnimateWaveform } from "./useAnimateWaveform";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

interface WaveformProps {
  waveformData: AudioBuffer;
  positionMS: RefObject<number>;
  initialViewport?: Section;
  initialSelection?: Section;
  onRangeChange?: (viewport: Section) => void;
  onLoopChange: (loop: Section | undefined) => void;
  onPosition: (sample: number) => void;
}

/** Audio content slot for the Timeline: waveform canvas + keyboard zoom/scroll. */
export const Waveform: FC<WaveformProps> = ({
  waveformData,
  positionMS,
  initialViewport,
  initialSelection,
  onRangeChange,
  onLoopChange,
  onPosition,
}) => {
  const { stateRef, setViewport } = useTimelineState(
    waveformData.length,
    initialViewport,
    initialSelection,
  );

  const handleRange = useCallback(
    (viewport: Section) => {
      setViewport(viewport);
      onRangeChange?.(viewport);
    },
    [setViewport, onRangeChange],
  );

  // Keyboard zoom/scroll is discrete, so the loop is committed right away.
  const handleKeyboardRange = useCallback(
    (viewport: Section) => {
      handleRange(viewport);
      onLoopChange(loopToSection(viewport, stateRef.current.loop));
    },
    [handleRange, onLoopChange, stateRef],
  );

  const canvasRef = useAnimateWaveform(waveformData, stateRef);
  useKeyboardShortcuts(waveformData, stateRef, handleKeyboardRange);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col p-4">
      <Timeline
        stateRef={stateRef}
        totalSamples={waveformData.length}
        sampleRate={waveformData.sampleRate}
        positionMS={positionMS}
        onRangeChange={handleRange}
        onPosition={onPosition}
        onLoopChange={onLoopChange}
      >
        <canvas
          id="waveform-canvas"
          ref={canvasRef}
          draggable="false"
          className="block w-full flex-1 min-w-0 min-h-0 select-none pixelated"
        />
      </Timeline>
    </div>
  );
};
