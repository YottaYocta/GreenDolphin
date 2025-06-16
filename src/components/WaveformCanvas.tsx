import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type FC,
  type RefObject,
} from "react";
import {
  computeSampleIndex,
  renderWaveform,
  type Section,
  type WaveformData,
  type WaveformStyle,
} from "../lib/waveform";

export interface WaveformCanvasProps {
  waveformData: WaveformData;
  animate: boolean;
  positionReference?: RefObject<number>;
  waveformStyle?: WaveformStyle;
  allowZoomPan?: boolean;
  handleRangeChange?: (newRange: Section) => void;
  handleSelection?: (selection: Section) => void;
  handlePosition?: (position: number) => void;
}

export const WaveformCanvas: FC<
  WaveformCanvasProps & CanvasHTMLAttributes<HTMLCanvasElement>
> = ({
  waveformData,
  animate,
  waveformStyle = { resolution: 10000 },
  positionReference,
  allowZoomPan = true,
  handleRangeChange,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [localData, setLocalData] = useState<WaveformData>({
    ...waveformData,
  });

  const setRange = (
    setRangeCallback: (prevData: WaveformData, prevRange: Section) => Section
  ) => {
    setLocalData((prevLocalData) => ({
      ...prevLocalData,
      range: setRangeCallback(prevLocalData, prevLocalData.range),
    }));
  };

  const updateWaveform = useCallback(() => {
    if (canvasRef.current)
      renderWaveform(
        localData,
        waveformStyle,
        canvasRef.current,
        positionReference?.current
          ? (positionReference.current * waveformData.data.sampleRate) / 1000
          : undefined
      );
  }, [
    localData,
    positionReference,
    waveformData.data.sampleRate,
    waveformStyle,
  ]);

  useEffect(() => {
    if (
      (waveformData.section && waveformData.section !== localData.section) ||
      waveformData.data !== localData.data
    )
      setLocalData({ ...waveformData });
  }, [localData.data, localData.section, waveformData]);

  useEffect(() => {
    if (canvasRef.current) {
      updateWaveform();
    }
  }, [updateWaveform]);

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef.current) {
        updateWaveform();
      }
      if (animate) {
        animationFrameId = requestAnimationFrame(renderLoop);
      }
    };

    if (animate) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [animate, updateWaveform]);

  useEffect(() => {
    if (handleRangeChange) {
      handleRangeChange(localData.range);
    }
  }, [handleRangeChange, localData.range]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleClick = (e: MouseEvent) => {
      if (handlePosition) {
        const sampleIndex = computeSampleIndex(
          e.offsetX,
          localData.range.end - localData.range.start,
          canvasElement
        );
        handlePosition(localData.range.start + sampleIndex);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setRange((prevWaveform, prevRange) => {
        const rangeLength = prevRange.end - prevRange.start;
        if ((Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) > 0.5) {
          const targetStart = prevRange.start + e.deltaX * (rangeLength / 400);
          const targetEnd = targetStart + rangeLength;
          if (targetEnd > prevWaveform.data.length) {
            const start = Math.max(0, prevWaveform.data.length - rangeLength);
            return {
              start: start,
              end: start + rangeLength,
            };
          } else if (targetStart < 0) {
            const start = 0;
            return {
              start: start,
              end: start + rangeLength,
            };
          } else {
            const start = Math.floor(targetStart);
            return {
              start: start,
              end: start + rangeLength,
            };
          }
        } else {
          const currentRange = prevRange.end - prevRange.start;
          const before =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) /
            currentRange;
          const after = 1 - before;

          const targetRange = Math.max(
            2,
            Math.min(
              prevWaveform.data.length,
              currentRange * (1 + -e.deltaY / 1000)
            )
          );

          const targetBefore = targetRange * before;
          const targetAfter = targetRange * after;

          const currentTarget =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) +
            prevRange.start;
          return {
            start: Math.floor(Math.max(0, currentTarget - targetBefore)),
            end: Math.floor(
              Math.min(currentTarget + targetAfter, prevWaveform.data.length)
            ),
          };
        }
      });
    };

    const handleResize = () => {
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      updateWaveform();
    };

    if (allowZoomPan) {
      canvasElement.addEventListener("wheel", handleWheel);
      // console.log(`[ADD] Zoom/Pan on ${canvasElement.nodeName}`);
    }

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial call to set resolution

    canvasElement.addEventListener("mousedown", handleClick);
    // console.log(`[ADD] Click/Press on ${canvasElement.nodeName}`);

    return () => {
      if (allowZoomPan) {
        canvasElement.removeEventListener("wheel", handleWheel);
        // console.log(`[REMOVE] Zoom/Pan on ${canvasElement.nodeName}`);
      }
      window.removeEventListener("resize", handleResize);
      canvasElement.removeEventListener("mousedown", handleClick);
      // console.log(`[REMOVE] Click/Press on ${canvasElement.nodeName}`);
    };
  }, [allowZoomPan, handlePosition, localData.range, updateWaveform]);

  return <canvas {...props} ref={canvasRef}></canvas>;
};
