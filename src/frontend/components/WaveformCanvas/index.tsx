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
import { useMouseDown } from "./useMouseDown";
import { useTouch } from "./useTouch";
import { useWheel } from "./useWheel";
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

export const WaveformCanvasV2: FC<
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

  useWheel(waveformData, metadataRef, canvasRef, handleRange);
  useMouseDown(
    waveformData,
    metadataRef,
    canvasRef,
    handleRange,
    handleSetPosition,
  );
  useTouch(
    waveformData,
    metadataRef,
    canvasRef,
    handleRange,
    handleSetPosition,
  );
  useAnimateWaveform(canvasRef, waveformData, metadataRef, positionMS);
  useKeyboardShortcuts(waveformData, metadataRef, handleRange);

  return (
    <div className="w-full flex flex-col px-4 h-full min-h-0">
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
      <canvas
        id="waveform-canvas"
        {...props}
        ref={canvasRef}
        draggable="false"
        className="relative z-0 cursor-pointer w-full flex-1 min-w-0 min-h-0 select-none pixelated"
      />
    </div>
  );
};
