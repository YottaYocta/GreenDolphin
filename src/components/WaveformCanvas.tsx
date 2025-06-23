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
  renderWaveform,
  type Section,
  type WaveformData,
  type WaveformStyle,
} from "../lib/waveform";
import { clampSection } from "../lib/util";
import { Button } from "./buttons";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";

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
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [localData, setLocalData] = useState<WaveformData>({
    ...waveformData,
  });

  const [selectRange, setSelectRange] = useState<Section | undefined>();

  const CLICK_SELECTION_THRESHOLD = 0.01;
  const clickSelectThresholdValue = useMemo(
    () =>
      CLICK_SELECTION_THRESHOLD * (localData.range.end - localData.range.start),
    [localData.range.end, localData.range.start]
  );

  const MIN_RANGE_THRESHOLD = 0.005;
  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(MIN_RANGE_THRESHOLD * localData.data.length);
    return value;
  }, [localData.data.length]);

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
        selectRange !== undefined &&
          Math.abs(selectRange.end - selectRange.start) >
            clickSelectThresholdValue
          ? {
              ...localData,
              section: {
                start: Math.min(selectRange.end, selectRange.start),
                end: Math.max(selectRange.end, selectRange.start),
              },
            }
          : localData,
        waveformStyle,
        canvasRef.current,
        positionReference?.current
          ? (positionReference.current * waveformData.data.sampleRate) / 1000
          : undefined
      );
  }, [
    clickSelectThresholdValue,
    selectRange,
    localData,
    positionReference,
    waveformData.data.sampleRate,
    waveformStyle,
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
    if (canvasRef.current) {
      updateWaveform();
    }
  }, [updateWaveform]);

  /**
   * if cursor position is outside of range, scroll to include cursor position
   */
  const checkScroll = useCallback(() => {
    if (positionReference && positionReference.current) {
      const sample =
        (positionReference.current * waveformData.data.sampleRate) / 1000;
      if (sample > localData.range.end) {
        setRange((prevData, prevRange) => {
          const currentRangeLength = prevRange.end - prevRange.start;
          const targetStart = sample;
          const targetEnd = targetStart + currentRangeLength;
          const clampedSection = clampSection(
            { start: targetStart, end: targetEnd },
            { start: 0, end: prevData.data.length }
          );
          return clampedSection;
        });
      } else if (sample < localData.range.start) {
        setRange((prevData, prevRange) => {
          const currentRangeLength = prevRange.end - prevRange.start;
          const targetEnd = sample;
          const targetStart = targetEnd - currentRangeLength;
          const clampedSection = clampSection(
            { start: targetStart, end: targetEnd },
            { start: 0, end: prevData.data.length }
          );
          return clampedSection;
        });
      }
    }
  }, [
    localData.range.end,
    localData.range.start,
    positionReference,
    waveformData.data.sampleRate,
  ]);

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
    if (handleRangeChange) {
      handleRangeChange(localData.range);
    }
  }, [handleRangeChange, localData.range]);

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

      setRange((prevWaveform, prevRange) => {
        const rangeLength = prevRange.end - prevRange.start;
        if ((Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) > 0.5) {
          const targetStart = prevRange.start + e.deltaX * (rangeLength / 400);
          const targetEnd = targetStart + rangeLength;
          return clampSection(
            { start: targetStart, end: targetEnd },
            { start: 0, end: localData.data.length }
          );
        } else {
          const currentRange = prevRange.end - prevRange.start;
          const before =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) /
            currentRange;
          const after = 1 - before;

          const targetRange = Math.max(
            Math.floor(minRangeThresholdValue),
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
    handleSelection,
    localData.data.length,
    localData.range,
    minRangeThresholdValue,
    selectRange,
    updateWaveform,
  ]);

  return (
    <div className="relative">
      <canvas {...props} ref={canvasRef}></canvas>
      {allowZoomPan ? (
        <div className="group flex flex-row gap-2 absolute bottom-1 right-1 z-10 w-min opacity-70 hover:opacity-100 focus:opacity-100 focus-within:opacity-100">
          <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
            <Button
              ariaLabel="zoom in"
              icon={<ZoomInIcon width={18} height={18}></ZoomInIcon>}
              onClick={() => {
                setRange((prevData, prevRange) => {
                  const zoomAmount = Math.floor(
                    (prevRange.end - prevRange.start) * 0.1
                  );

                  const targetSection = {
                    start: prevRange.start + zoomAmount,
                    end: prevRange.end - zoomAmount,
                  };
                  const midPoint =
                    Math.floor((prevRange.end - prevRange.start) / 2) +
                    prevRange.start;

                  const minSection = {
                    start: Math.floor(midPoint - minRangeThresholdValue / 2),
                    end: Math.floor(midPoint + minRangeThresholdValue / 2),
                  };
                  const targetSectionMinClamped = {
                    start: Math.min(minSection.start, targetSection.start),
                    end: Math.max(minSection.end, targetSection.end),
                  };

                  return clampSection(targetSectionMinClamped, {
                    start: 0,
                    end: prevData.data.length,
                  });
                });
              }}
            ></Button>
            <Button
              ariaLabel="zoom out"
              icon={<ZoomOutIcon width={18} height={18}></ZoomOutIcon>}
              onClick={() => {
                setRange((prevData, prevRange) => {
                  const scrollAmount = Math.floor(
                    (prevRange.end - prevRange.start) * 0.1
                  );
                  return clampSection(
                    {
                      start: prevRange.start - scrollAmount,
                      end: prevRange.end + scrollAmount,
                    },
                    { start: 0, end: prevData.data.length }
                  );
                });
              }}
            ></Button>
          </div>
          <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
            <Button
              ariaLabel="scroll left"
              icon={<ChevronLeftIcon width={18} height={18}></ChevronLeftIcon>}
              onClick={() => {
                setRange((prevData, prevRange) => {
                  const shiftAmount = Math.floor(
                    (prevRange.end - prevRange.start) * 0.1
                  );
                  const targetRange = {
                    start: prevData.range.start - shiftAmount,
                    end: prevData.range.end - shiftAmount,
                  };
                  if (targetRange.start < 0) {
                    return {
                      start: 0,
                      end: prevRange.end - prevRange.start,
                    };
                  } else return targetRange;
                });
              }}
            ></Button>
            <Button
              ariaLabel="scroll right"
              icon={
                <ChevronRightIcon width={18} height={18}></ChevronRightIcon>
              }
              onClick={() => {
                setRange((prevData, prevRange) => {
                  const shiftAmount = Math.floor(
                    (prevRange.end - prevRange.start) * 0.1
                  );
                  const targetRange = {
                    start: prevData.range.start + shiftAmount,
                    end: prevData.range.end + shiftAmount,
                  };
                  if (targetRange.end > prevData.data.length) {
                    return {
                      start:
                        prevData.data.length -
                        (prevRange.end - prevRange.start),
                      end: prevData.data.length,
                    };
                  } else return targetRange;
                });
              }}
            ></Button>
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};
