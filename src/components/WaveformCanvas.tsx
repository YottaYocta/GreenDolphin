import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type FC,
  type RefObject,
} from "react";
import {
  computeSampleIndex,
  type Section,
  type WaveformData,
} from "../lib/waveform";
import { clampSection, MStoSampleIndex } from "../lib/util";
import {
  CLICK_SELECTION_THRESHOLD,
  MIN_RANGE_THRESHOLD,
} from "../lib/constants";

export type WaveformRenderFunction = (
  data: WaveformData,
  canvas: HTMLCanvasElement,
  position?: number
) => void;

export interface WaveformCanvasProps {
  waveformData: WaveformData;
  animate: boolean;
  renderFunction: WaveformRenderFunction;
  positionReference?: RefObject<number>;
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
  renderFunction,
  positionReference,
  allowZoomPan = true,
  handleRangeChange,
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [localData, setLocalData] = useState<WaveformData>({
    ...waveformData,
  });

  useEffect(() => {
    setLocalData(waveformData);
  }, [waveformData]);

  const [selectRange, setSelectRange] = useState<Section | undefined>();

  const clickSelectThresholdValue = useMemo(
    () =>
      CLICK_SELECTION_THRESHOLD * (localData.range.end - localData.range.start),
    [localData.range.end, localData.range.start]
  );

  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(MIN_RANGE_THRESHOLD * localData.data.length);
    return value;
  }, [localData.data.length]);

  const updateWaveform = useCallback(() => {
    if (canvasRef.current)
      renderFunction(
        {
          ...localData,
          section:
            selectRange &&
            Math.abs(selectRange.end - selectRange.start) >
              minRangeThresholdValue
              ? {
                  start: Math.min(selectRange.end, selectRange.start),
                  end: Math.max(selectRange.end, selectRange.start),
                }
              : localData.section,
        },
        canvasRef.current,
        positionReference && positionReference.current
          ? MStoSampleIndex(
              localData.data.sampleRate,
              positionReference.current
            )
          : undefined
      );
  }, [
    localData,
    minRangeThresholdValue,
    positionReference,
    renderFunction,
    selectRange,
  ]);

  useEffect(() => {
    if (waveformData.section && waveformData.section !== localData.section)
      setLocalData((prevData) => ({ ...waveformData, range: prevData.range }));
    else if (waveformData.data !== localData.data) setLocalData(waveformData);

    if (waveformData.section !== localData.section) {
      setLocalData((prevData) => ({
        ...prevData,
        section: waveformData.section,
      }));
    }
  }, [localData.data, localData.section, selectRange, waveformData]);

  useEffect(() => {
    updateWaveform();
  }, [updateWaveform]);

  /**
   * if cursor position is outside of range, scroll to include cursor position
   */
  const checkScroll = useCallback(() => {
    if (positionReference && positionReference.current) {
      const sample =
        (positionReference.current * waveformData.data.sampleRate) / 1000;
      if (sample > localData.range.end) {
        const currentRangeLength = localData.range.end - localData.range.start;
        const targetStart = sample;
        const targetEnd = targetStart + currentRangeLength;
        const clampedSection = clampSection(
          { start: targetStart, end: targetEnd },
          { start: 0, end: localData.data.length }
        );
        if (handleRangeChange) handleRangeChange(clampedSection);
      } else if (sample < localData.range.start) {
        const currentRangeLength = localData.range.end - localData.range.start;
        const targetEnd = sample;
        const targetStart = targetEnd - currentRangeLength;
        const clampedSection = clampSection(
          { start: targetStart, end: targetEnd },
          { start: 0, end: localData.data.length }
        );
        if (handleRangeChange) handleRangeChange(clampedSection);
      }
    }
  }, [
    handleRangeChange,
    localData.data.length,
    localData.range.end,
    localData.range.start,
    positionReference,
    waveformData.data.sampleRate,
  ]);

  // console.log("[WaveformCanvas] Rerender");

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef.current) {
        updateWaveform();
      }
      if (animate) {
        checkScroll();
        animationFrameId = requestAnimationFrame(renderLoop);
      }
    };

    if (animate) {
      checkScroll();
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [animate, checkScroll, updateWaveform]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleMove = (e: MouseEvent) => {
      if (selectRange !== undefined) {
        const endSample =
          computeSampleIndex(
            e.offsetX,
            localData.range.end - localData.range.start,
            canvasElement
          ) + localData.range.start;
        setSelectRange({
          start: selectRange.start,
          end: endSample,
        });
      }
    };

    const handleMouseUp = () => {
      if (selectRange !== undefined) {
        const min = Math.min(selectRange.start, selectRange.end);
        const max = Math.max(selectRange.start, selectRange.end);
        if (max - min > clickSelectThresholdValue) {
          setLocalData((prevData) => ({
            ...prevData,
            section: { start: min, end: max },
          }));
          if (handleSelection) handleSelection({ start: min, end: max });
        } else if (handlePosition) handlePosition(selectRange.start);
      }
      setSelectRange(undefined);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const sampleIndex =
        computeSampleIndex(
          e.offsetX,
          localData.range.end - localData.range.start,
          canvasElement
        ) + localData.range.start;

      setSelectRange({ start: sampleIndex, end: sampleIndex });
    };

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (handleRangeChange) {
        const rangeLength = localData.range.end - localData.range.start;
        if ((Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) > 0.5) {
          const targetStart =
            localData.range.start + e.deltaX * (rangeLength / 400);
          const targetEnd = targetStart + rangeLength;
          handleRangeChange(
            clampSection(
              { start: targetStart, end: targetEnd },
              { start: 0, end: localData.data.length }
            )
          );
        } else {
          const currentRange = localData.range.end - localData.range.start;
          const before =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) /
            currentRange;
          const after = 1 - before;

          const targetRange = Math.max(
            Math.floor(minRangeThresholdValue),
            Math.min(
              localData.data.length,
              currentRange * (1 + -e.deltaY / 1000)
            )
          );

          const targetBefore = targetRange * before;
          const targetAfter = targetRange * after;

          const currentTarget =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) +
            localData.range.start;
          handleRangeChange({
            start: Math.floor(Math.max(0, currentTarget - targetBefore)),
            end: Math.floor(
              Math.min(currentTarget + targetAfter, localData.data.length)
            ),
          });
        }
      }
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

    canvasElement.addEventListener("mousedown", handleMouseDown);
    canvasElement.addEventListener("mousemove", handleMove);
    canvasElement.addEventListener("mouseup", handleMouseUp);
    canvasElement.addEventListener("mouseleave", handleMouseUp);
    // console.log(`[ADD] Click/Press on ${canvasElement.nodeName}`);

    return () => {
      if (allowZoomPan) {
        canvasElement.removeEventListener("wheel", handleWheel);
        // console.log(`[REMOVE] Zoom/Pan on ${canvasElement.nodeName}`);
      }
      window.removeEventListener("resize", handleResize);
      canvasElement.removeEventListener("mousedown", handleMouseDown);
      canvasElement.removeEventListener("mousemove", handleMove);
      canvasElement.removeEventListener("mouseup", handleMouseUp);
      canvasElement.removeEventListener("mouseleave", handleMouseUp);
      // console.log(`[REMOVE] Click/Press on ${canvasElement.nodeName}`);
    };
  }, [
    allowZoomPan,
    clickSelectThresholdValue,
    handlePosition,
    handleRangeChange,
    handleSelection,
    localData.data.length,
    localData.range.end,
    localData.range.start,
    minRangeThresholdValue,
    selectRange,
    updateWaveform,
  ]);

  return (
    <div className="relative pixelated cursor-pointer select-none">
      <canvas {...props} ref={canvasRef} draggable="false"></canvas>
    </div>
  );
};
