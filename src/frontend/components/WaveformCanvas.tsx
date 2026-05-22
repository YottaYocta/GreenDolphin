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
  position?: number,
) => void;

export interface WaveformCanvasProps {
  waveformData: WaveformData;
  animate: boolean;
  renderFunction: WaveformRenderFunction;
  positionReference?: RefObject<number>;
  allowZoomPan?: boolean;
  showHandles?: boolean;
  handleRangeChange?: (newRange: Section) => void;
  handleSelection?: (selection: Section) => void;
  handlePosition?: (position: number) => void;
}

interface CanvasGesture {
  offsetX: number;
  offsetY: number;
}

export const WaveformCanvas: FC<
  WaveformCanvasProps & CanvasHTMLAttributes<HTMLCanvasElement>
> = ({
  waveformData,
  animate,
  renderFunction,
  positionReference,
  allowZoomPan = true,
  showHandles = false,
  handleRangeChange,
  handleSelection,
  handlePosition,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localData, setLocalData] = useState<WaveformData>({
    ...waveformData,
  });
  const prevWaveformData = useRef(waveformData);

  useEffect(() => {
    const prev = prevWaveformData.current;
    prevWaveformData.current = waveformData;

    if (waveformData.data !== prev.data) {
      setLocalData(waveformData);
      return;
    }

    const rangeChanged =
      waveformData.range.start !== prev.range.start ||
      waveformData.range.end !== prev.range.end;
    const sectionChanged =
      waveformData.section?.start !== prev.section?.start ||
      waveformData.section?.end !== prev.section?.end;

    if (rangeChanged || sectionChanged) {
      setLocalData((prevLocal) => ({
        ...prevLocal,
        ...(rangeChanged ? { range: waveformData.range } : {}),
        ...(sectionChanged ? { section: waveformData.section } : {}),
      }));
    }
  }, [waveformData]);

  const [selectRange, setSelectRange] = useState<Section | undefined>();
  const [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(
    null,
  );
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);

  const clickSelectThresholdValue = useMemo(
    () =>
      CLICK_SELECTION_THRESHOLD * (localData.range.end - localData.range.start),
    [localData.range.end, localData.range.start],
  );

  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(MIN_RANGE_THRESHOLD * localData.data.length);
    return value;
  }, [localData.data.length]);

  const positionHandleRef = useRef<HTMLDivElement>(null);

  const updateWaveform = useCallback(() => {
    if (positionHandleRef.current && positionReference?.current != null) {
      const sampleIndex = MStoSampleIndex(
        localData.data.sampleRate,
        positionReference.current,
      );
      const rangeLen = localData.range.end - localData.range.start;
      const pct = ((sampleIndex - localData.range.start) / rangeLen) * 100;
      if (pct >= 0 && pct <= 100) {
        positionHandleRef.current.style.left = `${pct}%`;
        positionHandleRef.current.style.display = "";
      } else {
        positionHandleRef.current.style.display = "none";
      }
    }

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
              positionReference.current,
            )
          : undefined,
      );
  }, [
    localData,
    minRangeThresholdValue,
    positionReference,
    renderFunction,
    selectRange,
  ]);

  // useEffect(() => {
  //   if (waveformData.section && waveformData.section !== localData.section) {
  //     setLocalData((prevData) => ({ ...waveformData, range: prevData.range }));
  //     console.log("a");
  //   } else if (waveformData.data !== localData.data) {
  //     setLocalData(waveformData);
  //     console.log("b");
  //   }

  //   if (waveformData.section !== localData.section) {
  //     setLocalData((prevData) => ({
  //       ...prevData,
  //       section: waveformData.section,
  //     }));

  //     console.log("c");
  //   }
  // }, [localData.data, localData.section, selectRange, waveformData]);

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
          { start: 0, end: localData.data.length },
        );
        if (handleRangeChange) handleRangeChange(clampedSection);
      } else if (sample < localData.range.start) {
        const currentRangeLength = localData.range.end - localData.range.start;
        const targetEnd = sample;
        const targetStart = targetEnd - currentRangeLength;
        const clampedSection = clampSection(
          { start: targetStart, end: targetEnd },
          { start: 0, end: localData.data.length },
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

    const handleMove = (e: CanvasGesture) => {
      if (selectRange !== undefined) {
        const endSample =
          computeSampleIndex(
            e.offsetX,
            localData.range.end - localData.range.start,
            canvasElement,
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

    const handleMouseDown = (e: CanvasGesture) => {
      const sampleIndex =
        computeSampleIndex(
          e.offsetX,
          localData.range.end - localData.range.start,
          canvasElement,
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
              { start: 0, end: localData.data.length },
            ),
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
              currentRange * (1 + -e.deltaY / 1000),
            ),
          );

          const targetBefore = targetRange * before;
          const targetAfter = targetRange * after;

          const currentTarget =
            computeSampleIndex(e.offsetX, currentRange, canvasElement) +
            localData.range.start;
          handleRangeChange({
            start: Math.floor(Math.max(0, currentTarget - targetBefore)),
            end: Math.floor(
              Math.min(currentTarget + targetAfter, localData.data.length),
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

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        const touchGesture: CanvasGesture = {
          offsetX: e.touches[0].clientX,
          offsetY: e.touches[0].clientX,
        };
        handleMouseDown(touchGesture);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        const touchGesture: CanvasGesture = {
          offsetX: e.touches[0].clientX,
          offsetY: e.touches[0].clientX,
        };
        handleMove(touchGesture);
      }
    };

    canvasElement.addEventListener("touchstart", handleTouchStart);
    canvasElement.addEventListener("touchmove", handleTouchMove);
    canvasElement.addEventListener("touchend", handleMouseUp);
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
      canvasElement.removeEventListener("touchstart", handleTouchStart);
      canvasElement.removeEventListener("touchmove", handleTouchMove);
      canvasElement.removeEventListener("touchend", handleMouseUp);

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

  useEffect(() => {
    console.log(localData.range, localData.section);
  }, [localData.range, localData.section]);

  const handlePositions = useMemo(() => {
    const section = localData.section;
    if (!section) return null;
    const rangeLen = localData.range.end - localData.range.start;
    if (rangeLen <= 0) return null;
    return {
      startPct: ((section.start - localData.range.start) / rangeLen) * 100,
      endPct: ((section.end - localData.range.start) / rangeLen) * 100,
    };
  }, [localData.range, localData.section]);

  useEffect(() => {
    if (!draggingHandle) return;

    const onMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const sampleIndex =
        Math.round(fraction * (localData.range.end - localData.range.start)) +
        localData.range.start;

      setLocalData((prev) => {
        if (!prev.section) return prev;
        const newSection =
          draggingHandle === "start"
            ? {
                start: Math.min(sampleIndex, prev.section.end - 1),
                end: prev.section.end,
              }
            : {
                start: prev.section.start,
                end: Math.max(sampleIndex, prev.section.start + 1),
              };
        // console.log(newSection);
        return { ...prev, section: newSection };
      });
    };

    const onEnd = () => {
      if (localData.section && handleSelection)
        handleSelection(localData.section);
      setDraggingHandle(null);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [
    draggingHandle,
    handleSelection,
    localData.range,
    localData.section,
    setLocalData,
  ]);

  useEffect(() => {
    if (!draggingPlayhead) return;

    const onMove = (clientX: number) => {
      if (!containerRef.current || !handlePosition) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const sampleIndex =
        Math.round(fraction * (localData.range.end - localData.range.start)) +
        localData.range.start;
      handlePosition(sampleIndex);
    };

    const onEnd = () => setDraggingPlayhead(false);
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [draggingPlayhead, handlePosition, localData.range]);

  return (
    <div ref={containerRef} className="flex flex-col pixelated select-none">
      <canvas
        {...props}
        ref={canvasRef}
        draggable="false"
        className="cursor-pointer border border-neutral-2"
      ></canvas>
      {showHandles && (handlePositions || positionReference) && (
        <div className="relative w-full h-7 shrink-0 overflow-hidden">
          {handlePositions && localData.section && (
            <>
              {handlePositions.startPct >= 0 &&
                handlePositions.startPct <= 100 && (
                  <SectionHandle
                    pct={handlePositions.startPct}
                    onDragStart={() => setDraggingHandle("start")}
                  />
                )}
              {handlePositions.endPct >= 0 &&
                handlePositions.endPct <= 100 && (
                  <SectionHandle
                    pct={handlePositions.endPct}
                    onDragStart={() => setDraggingHandle("end")}
                  />
                )}
            </>
          )}
          {positionReference && (
            <div
              ref={positionHandleRef}
              className="absolute top-0 w-5 h-full -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-10"
              style={{ display: "none" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggingPlayhead(true);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setDraggingPlayhead(true);
              }}
            >
              <div className="w-4 h-4 rounded-sm bg-sky-400 opacity-90" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SectionHandle: FC<{ pct: number; onDragStart: () => void }> = ({
  pct,
  onDragStart,
}) => (
  <div
    className="absolute top-0 w-5 h-full -translate-x-1/2 flex items-center justify-center cursor-ew-resize"
    style={{ left: `${pct}%` }}
    onMouseDown={(e) => {
      e.stopPropagation();
      onDragStart();
    }}
    onTouchStart={(e) => {
      e.stopPropagation();
      onDragStart();
    }}
  >
    <div className="w-4 h-5 rounded-sm bg-emerald-400 opacity-90" />
  </div>
);
