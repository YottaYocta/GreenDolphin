import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type FC,
  type RefObject,
} from "react";

import { type Section } from "../../lib/waveform";
import type { WaveformMetadata } from "./types";
import { useAnimateWaveform } from "./useAnimateWaveform";
import { useMouseDown } from "./useMouseDown";
import { useWheel } from "./useWheel";

export type WaveformRenderFunction = (
  data: AudioBuffer,
  canvas: HTMLCanvasElement,
  position?: number,
) => void;

export interface WaveformCanvasProps {
  waveformData: AudioBuffer;
  positionReference?: RefObject<number>;
  showHandles?: boolean;
  handleRangeChange?: (newRange: Section) => void;
  handleSelection?: (selection: Section) => void;
  handlePosition?: (position: number) => void;
}

export const WaveformCanvasV2: FC<
  WaveformCanvasProps & CanvasHTMLAttributes<HTMLCanvasElement>
> = ({
  waveformData,
  positionReference,
  handleRangeChange,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [metadata, setMetadata] = useState<WaveformMetadata>({
    range: {
      start: 0,
      end: waveformData.length,
    },
  });

  useEffect(() => {
    setMetadata({
      range: {
        start: 0,
        end: waveformData.length,
      },
    });
  }, [waveformData]);

  const handleRange = useCallback(
    (range: Section) => {
      handleRangeChange?.(range);
      setMetadata({ ...metadata, range });
    },
    [handleRangeChange, metadata],
  );

  const handleSetPosition = useCallback(
    (position: number) => {
      handlePosition?.(position);
    },
    [handlePosition],
  );

  useWheel(waveformData, metadata, canvasRef, handleRange);
  useMouseDown(waveformData, metadata, canvasRef, handleRange, handleSetPosition);
  useAnimateWaveform(canvasRef, waveformData, metadata, positionReference);

  return (
    <canvas
      id="waveform-canvas"
      {...props}
      ref={canvasRef}
      draggable="false"
      className="relative z-0 cursor-pointer w-full max-md:h-32 h-48 select-none pixelated"
    ></canvas>
  );
};
