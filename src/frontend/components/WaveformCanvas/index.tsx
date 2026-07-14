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
import { useSessionRestore } from "./useSessionRestore";
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
  filename?: string;
  positionMS?: RefObject<number>;
  showHandles?: boolean;
  handleRangeChange?: (newRange: Section) => void;
  handleSelection?: (selection: Section) => void;
  handlePosition?: (position: number) => void;
}

export const WaveformCanvasV2: FC<
  WaveformCanvasProps & CanvasHTMLAttributes<HTMLCanvasElement>
> = ({
  waveformData,
  filename,
  positionMS,
  handleRangeChange,
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullRange = { start: 0, end: waveformData.length };
  const metadataRef = useRef<WaveformMetadata>({
    range: fullRange,
    section: fullRange,
  });

  useEffect(() => {
    metadataRef.current = {
      range: { start: 0, end: waveformData.length },
      section: { start: 0, end: waveformData.length },
    };
  }, [waveformData]);

  const handleRange = useCallback(
    (range: Section) => {
      metadataRef.current = { ...metadataRef.current, range };
      handleRangeChange?.(range);
    },
    [handleRangeChange],
  );

  const handleSetPosition = useCallback(
    (position: number) => handlePosition?.(position),
    [handlePosition],
  );

  const handleLoopEdit = useCallback((section: Section) => {
    metadataRef.current = { ...metadataRef.current, section };
  }, []);

  const handleLoopEditFinish = useCallback(
    (section: Section) => {
      metadataRef.current = { ...metadataRef.current, section };
      handleSelection?.(section);
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
  useSessionRestore(filename, handleRange);

  return (
    <div className="w-full flex flex-col px-4">
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
        className="relative z-0 cursor-pointer w-full max-md:h-32 h-48 select-none pixelated"
      />
    </div>
  );
};
