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
import { useDrag } from "../lib/useDrag";

const MAX_BAR_OFFSET = 20;
const RUBBER_SCALE = 80;

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
  const [draggingPan, setDraggingPan] = useState(false);
  const lastPanX = useRef(0);
  const dragDistanceRef = useRef(0);
  const barContainerRef = useRef<HTMLDivElement>(null);

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

    const toSample = (offsetX: number) =>
      computeSampleIndex(offsetX, localData.range.end - localData.range.start, canvasElement) + localData.range.start;

    const onMouseDown = (e: MouseEvent) =>
      setSelectRange({ start: toSample(e.offsetX), end: toSample(e.offsetX) });

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const offsetX = e.touches[0].clientX - canvasElement.getBoundingClientRect().left;
      setSelectRange({ start: toSample(offsetX), end: toSample(offsetX) });
    };

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!handleRangeChange) return;
      const rangeLength = localData.range.end - localData.range.start;
      if ((Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) > 0.5) {
        const targetStart = localData.range.start + e.deltaX * (rangeLength / 400);
        handleRangeChange(clampSection(
          { start: targetStart, end: targetStart + rangeLength },
          { start: 0, end: localData.data.length },
        ));
      } else {
        const currentRange = localData.range.end - localData.range.start;
        const before = computeSampleIndex(e.offsetX, currentRange, canvasElement) / currentRange;
        const targetRange = Math.max(
          Math.floor(minRangeThresholdValue),
          Math.min(localData.data.length, currentRange * (1 + -e.deltaY / 1000)),
        );
        const currentTarget = computeSampleIndex(e.offsetX, currentRange, canvasElement) + localData.range.start;
        handleRangeChange({
          start: Math.floor(Math.max(0, currentTarget - targetRange * before)),
          end: Math.floor(Math.min(currentTarget + targetRange * (1 - before), localData.data.length)),
        });
      }
    };

    const handleResize = () => {
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      updateWaveform();
    };

    if (allowZoomPan) canvasElement.addEventListener("wheel", handleWheel);
    window.addEventListener("resize", handleResize);
    handleResize();
    canvasElement.addEventListener("mousedown", onMouseDown);
    canvasElement.addEventListener("touchstart", onTouchStart);

    return () => {
      if (allowZoomPan) canvasElement.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", handleResize);
      canvasElement.removeEventListener("mousedown", onMouseDown);
      canvasElement.removeEventListener("touchstart", onTouchStart);
    };
  }, [
    allowZoomPan,
    handleRangeChange,
    localData.data.length,
    localData.range.end,
    localData.range.start,
    minRangeThresholdValue,
    updateWaveform,
  ]);

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

  useDrag(
    selectRange !== undefined,
    (clientX) => {
      const canvas = canvasRef.current;
      if (!canvas || selectRange === undefined) return;
      const endSample =
        computeSampleIndex(clientX - canvas.getBoundingClientRect().left, localData.range.end - localData.range.start, canvas) +
        localData.range.start;
      setSelectRange({ start: selectRange.start, end: endSample });
    },
    () => {
      if (selectRange !== undefined) {
        const min = Math.min(selectRange.start, selectRange.end);
        const max = Math.max(selectRange.start, selectRange.end);
        if (max - min > clickSelectThresholdValue) {
          setLocalData((prev) => ({ ...prev, section: { start: min, end: max } }));
          handleSelection?.({ start: min, end: max });
        } else {
          handlePosition?.(selectRange.start);
        }
      }
      setSelectRange(undefined);
    },
  );

  useDrag(
    !!draggingHandle,
    (clientX) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const sampleIndex = Math.round(fraction * (localData.range.end - localData.range.start)) + localData.range.start;
      setLocalData((prev) => {
        if (!prev.section) return prev;
        return draggingHandle === "start"
          ? { ...prev, section: { start: Math.min(sampleIndex, prev.section.end - 1), end: prev.section.end } }
          : { ...prev, section: { start: prev.section.start, end: Math.max(sampleIndex, prev.section.start + 1) } };
      });
    },
    () => {
      if (localData.section && handleSelection) handleSelection(localData.section);
      setDraggingHandle(null);
    },
  );

  useDrag(
    draggingPlayhead,
    (clientX) => {
      if (!containerRef.current || !handlePosition) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      handlePosition(Math.round(fraction * (localData.range.end - localData.range.start)) + localData.range.start);
    },
    () => setDraggingPlayhead(false),
  );

  useDrag(
    draggingPan,
    (clientX) => {
      const deltaX = clientX - lastPanX.current;
      lastPanX.current = clientX;
      if (deltaX === 0 || !containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      if (width === 0) return;
      const { range, data } = localData;
      const rangeLen = range.end - range.start;
      const newStart = Math.max(0, Math.min(data.length - rangeLen, range.start + Math.round(-deltaX * (rangeLen / width))));
      const newRange = { start: newStart, end: newStart + rangeLen };
      setLocalData((prev) => ({ ...prev, range: newRange }));
      handleRangeChange?.(newRange);
      dragDistanceRef.current += deltaX;
      const d = dragDistanceRef.current;
      if (barContainerRef.current)
        barContainerRef.current.style.transform = `translateX(${Math.sign(d) * MAX_BAR_OFFSET * Math.tanh(Math.abs(d) / RUBBER_SCALE)}px)`;
    },
    () => {
      setDraggingPan(false);
      if (barContainerRef.current) {
        barContainerRef.current.style.transition = "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)";
        barContainerRef.current.style.transform = "translateX(0)";
      }
    },
  );

  return (
    <div ref={containerRef} className="flex flex-col pixelated select-none">
      <canvas
        {...props}
        ref={canvasRef}
        draggable="false"
        className="cursor-pointer w-full"
      ></canvas>
      {showHandles && (handlePositions || positionReference) && (
        <>
          <div className="relative z-10 w-full h-8 shrink-0 -mt-4">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 border-t border-b border-[#0000001A]" />
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
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5.75 -translate-x-1/2 cursor-ew-resize z-10 rounded-sm bg-[#19CA93] border border-[#00000033] [box-shadow:#FFFFFF80_0px_0px_3px_inset,#00000033_0px_2px_3px]"
                style={{ display: "none" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingPlayhead(true);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setDraggingPlayhead(true);
                }}
              />
            )}
          </div>
          <div
            className="-mt-4 w-full h-16 cursor-grab active:cursor-grabbing select-none flex items-center justify-center overflow-hidden"
            onMouseDown={(e) => {
              dragDistanceRef.current = 0;
              if (barContainerRef.current) {
                barContainerRef.current.style.transition = "none";
                barContainerRef.current.style.transform = "translateX(0)";
              }
              setDraggingPan(true);
              lastPanX.current = e.clientX;
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                dragDistanceRef.current = 0;
                if (barContainerRef.current) {
                  barContainerRef.current.style.transition = "none";
                  barContainerRef.current.style.transform = "translateX(0)";
                }
                setDraggingPan(true);
                lastPanX.current = e.touches[0].clientX;
              }
            }}
          >
            <div ref={barContainerRef} className="flex gap-1.5">
              <div className="w-0.5 h-4 rounded-full bg-[#00000020]" />
              <div className="w-0.5 h-4 rounded-full bg-[#00000020]" />
              <div className="w-0.5 h-4 rounded-full bg-[#00000020]" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SectionHandle: FC<{ pct: number; onDragStart: () => void }> = ({
  pct,
  onDragStart,
}) => (
  <div
    className="absolute top-1/2 -translate-y-1/2 w-7 h-7.75 -translate-x-1/2 cursor-ew-resize z-10 rounded-sm bg-[#FDFDFD] border border-[#0000001A] [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px]"
    style={{ left: `${pct}%` }}
    onMouseDown={(e) => {
      e.stopPropagation();
      onDragStart();
    }}
    onTouchStart={(e) => {
      e.stopPropagation();
      onDragStart();
    }}
  />
);
