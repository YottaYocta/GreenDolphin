import {
  useCallback,
  useEffect,
  useRef,
  type CanvasHTMLAttributes,
  type FC,
  type RefObject,
} from "react";

import { type Section } from "../../lib/waveform";
import type { WaveformMetadata } from "./types";
import { useAnimateWaveform } from "./useAnimateWaveform";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useViewportGestures } from "./useViewportGestures";
import { clampSample, pointerToSample } from "./trackbar/dragUtils";
import { Trackbar } from "./trackbar";

export type WaveformRenderFunction = (
  data: AudioBuffer,
  canvas: HTMLCanvasElement,
  position?: number,
) => void;

export interface WaveformCanvasProps {
  waveformData: AudioBuffer;
  positionMS?: RefObject<number>;
  showHandles?: boolean;
  initialViewport?: Section;
  initialSelection?: Section;
  handleRangeChange?: (newRange: Section) => void;
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
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullRange = { start: 0, end: waveformData.length };
  const metadataRef = useRef<WaveformMetadata>({
    viewport: initialViewport ?? fullRange,
    selection: initialSelection ?? fullRange,
  });

  useEffect(() => {
    metadataRef.current = {
      viewport: initialViewport ?? { start: 0, end: waveformData.length },
      selection: initialSelection ?? { start: 0, end: waveformData.length },
    };
  }, [waveformData, initialViewport, initialSelection]);

  const handleRange = useCallback(
    (viewport: Section) => {
      metadataRef.current = { ...metadataRef.current, viewport };
      handleRangeChange?.(viewport);
    },
    [handleRangeChange],
  );

  const handleSetPosition = useCallback(
    (position: number) => handlePosition?.(position),
    [handlePosition],
  );

  const handleLoopEdit = useCallback((selection: Section) => {
    metadataRef.current = { ...metadataRef.current, selection };
  }, []);

  const handleLoopEditFinish = useCallback(
    (selection: Section) => {
      metadataRef.current = { ...metadataRef.current, selection };
      handleSelection?.(selection);
    },
    [handleSelection],
  );

  const handleTap = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const sample = pointerToSample(
        clientX,
        canvas,
        metadataRef.current.viewport,
      );
      handleSetPosition(clampSample(sample, waveformData.length));
    },
    [handleSetPosition, waveformData.length],
  );

  useViewportGestures(
    canvasRef,
    metadataRef,
    waveformData.length,
    handleRange,
    handleTap,
  );
  useAnimateWaveform(canvasRef, waveformData, metadataRef, positionMS);
  useKeyboardShortcuts(waveformData, metadataRef, handleRange);

  return (
    <div className="w-full flex flex-col p-4 h-full min-h-0">
      <canvas
        id="waveform-canvas"
        {...props}
        ref={canvasRef}
        draggable="false"
        className="relative z-0 cursor-pointer w-full flex-1 min-w-0 min-h-0 select-none pixelated"
      />
      <Trackbar
        positionMS={positionMS}
        metadata={metadataRef}
        sampleRate={waveformData.sampleRate}
        totalSamples={waveformData.length}
        handleLoopEdit={handleLoopEdit}
        handleLoopEditFinish={handleLoopEditFinish}
        handlePosition={handleSetPosition}
        handleRange={handleRange}
      />
    </div>
  );
};
