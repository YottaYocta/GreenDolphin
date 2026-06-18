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

  const selectRangeRef = useRef<Section | undefined>(undefined);
  const draggingHandleRef = useRef<"start" | "end" | null>(null);
  const dragDistanceRef = useRef(0);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartRangeRef = useRef<Section | null>(null);
  const pinchMidpointFractionRef = useRef<number>(0);
  const isPinchingRef = useRef(false);

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

    if (canvasRef.current) {
      const sr = selectRangeRef.current;
      renderFunction(
        {
          ...localData,
          section:
            sr && Math.abs(sr.end - sr.start) > minRangeThresholdValue
              ? {
                  start: Math.min(sr.end, sr.start),
                  end: Math.max(sr.end, sr.start),
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
    }
  }, [localData, minRangeThresholdValue, positionReference, renderFunction]);

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef.current) updateWaveform();
      if (animate) animationFrameId = requestAnimationFrame(renderLoop);
    };

    if (animate) animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [animate, updateWaveform]);

  const [startSelectDrag, endSelectDrag] = useDrag(
    ({ clientX }) => {
      const canvas = canvasRef.current;
      if (!canvas || selectRangeRef.current === undefined) return;
      const rangeLen = localData.range.end - localData.range.start;
      const rawSample =
        computeSampleIndex(
          clientX - canvas.getBoundingClientRect().left,
          rangeLen,
          canvas,
        ) + localData.range.start;
      const endSample = Math.max(
        localData.range.start,
        Math.min(localData.range.end, rawSample),
      );
      selectRangeRef.current = {
        start: selectRangeRef.current.start,
        end: endSample,
      };
      updateWaveform();
    },
    () => {
      const sr = selectRangeRef.current;
      if (sr !== undefined) {
        const min = Math.min(sr.start, sr.end);
        const max = Math.max(sr.start, sr.end);
        if (max - min > clickSelectThresholdValue) {
          setLocalData((prev) => ({
            ...prev,
            section: { start: min, end: max },
          }));
          handleSelection?.({ start: min, end: max });
        } else {
          handlePosition?.(sr.start);
        }
      }
      selectRangeRef.current = undefined;
      updateWaveform();
    },
  );

  const [startHandleDrag] = useDrag(
    ({ clientX }) => {
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
        return draggingHandleRef.current === "start"
          ? {
              ...prev,
              section: {
                start: Math.min(sampleIndex, prev.section.end - 1),
                end: prev.section.end,
              },
            }
          : {
              ...prev,
              section: {
                start: prev.section.start,
                end: Math.max(sampleIndex, prev.section.start + 1),
              },
            };
      });
    },
    () => {
      if (localData.section && handleSelection)
        handleSelection(localData.section);
      draggingHandleRef.current = null;
    },
  );

  const [startPlayheadDrag] = useDrag(({ clientX }) => {
    if (!containerRef.current || !handlePosition) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width),
    );
    handlePosition(
      Math.round(fraction * (localData.range.end - localData.range.start)) +
        localData.range.start,
    );
  });

  const [startPanDrag] = useDrag(
    ({ dx }) => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      if (width === 0) return;
      const { range, data } = localData;
      const rangeLen = range.end - range.start;
      const newStart = Math.max(
        0,
        Math.min(
          data.length - rangeLen,
          range.start + Math.round(-dx * (rangeLen / width)),
        ),
      );
      const newRange = { start: newStart, end: newStart + rangeLen };
      setLocalData((prev) => ({ ...prev, range: newRange }));
      handleRangeChange?.(newRange);
      dragDistanceRef.current += dx;
      const d = dragDistanceRef.current;
      if (barContainerRef.current)
        barContainerRef.current.style.transform = `translateX(${Math.sign(d) * MAX_BAR_OFFSET * Math.tanh(Math.abs(d) / RUBBER_SCALE)}px)`;
    },
    () => {
      if (barContainerRef.current) {
        barContainerRef.current.style.transition =
          "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)";
        barContainerRef.current.style.transform = "translateX(0)";
      }
    },
  );

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const handleResize = () => {
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      updateWaveform();
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [updateWaveform]);

  useEffect(() => {
    if (!allowZoomPan) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!handleRangeChange) return;
      const { range, data } = localData;
      const currentRange = range.end - range.start;
      const sampleOffset = computeSampleIndex(e.offsetX, currentRange, canvas);
      const anchor = sampleOffset + range.start;
      const before = sampleOffset / currentRange;

      if (e.ctrlKey) {
        const targetLen = Math.max(
          minRangeThresholdValue,
          Math.min(data.length, currentRange * (1 + e.deltaY / 100)),
        );
        handleRangeChange(
          clampSection(
            {
              start: Math.floor(anchor - targetLen * before),
              end: Math.floor(anchor + targetLen * (1 - before)),
            },
            { start: 0, end: data.length },
          ),
        );
      } else if (
        (Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) >
        0.5
      ) {
        const targetStart = range.start + e.deltaX * (currentRange / 400);
        handleRangeChange(
          clampSection(
            { start: targetStart, end: targetStart + currentRange },
            { start: 0, end: data.length },
          ),
        );
      } else {
        const targetLen = Math.max(
          minRangeThresholdValue,
          Math.min(data.length, currentRange * (1 + -e.deltaY / 1000)),
        );
        handleRangeChange(
          clampSection(
            {
              start: Math.floor(anchor - targetLen * before),
              end: Math.floor(anchor + targetLen * (1 - before)),
            },
            { start: 0, end: data.length },
          ),
        );
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      isPinchingRef.current = true;
      endSelectDrag();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      pinchStartDistRef.current = dist;
      pinchStartRangeRef.current = { ...localData.range };
      const rect = canvas.getBoundingClientRect();
      const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const { range } = localData;
      const rangeLen = range.end - range.start;
      pinchMidpointFractionRef.current =
        computeSampleIndex(midX, rangeLen, canvas) / rangeLen;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const startDist = pinchStartDistRef.current;
      const startRange = pinchStartRangeRef.current;
      if (startDist === null || startRange === null) return;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = (startDist / dist) ** 2;
      const startRangeLen = startRange.end - startRange.start;
      const { data } = localData;
      const targetLen = Math.max(
        minRangeThresholdValue,
        Math.min(data.length, Math.round(startRangeLen * scale)),
      );
      const fraction = pinchMidpointFractionRef.current;
      const anchorSample = startRange.start + fraction * startRangeLen;
      handleRangeChange?.(
        clampSection(
          {
            start: Math.floor(anchorSample - targetLen * fraction),
            end: Math.floor(anchorSample - targetLen * fraction) + targetLen,
          },
          { start: 0, end: data.length },
        ),
      );
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
        pinchStartRangeRef.current = null;
        isPinchingRef.current = false;
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    allowZoomPan,
    endSelectDrag,
    handleRangeChange,
    localData,
    minRangeThresholdValue,
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

  return (
    <div
      ref={containerRef}
      className="flex flex-col pixelated select-none relative"
    >
      <canvas
        {...props}
        ref={canvasRef}
        draggable="false"
        className="relative z-0 cursor-pointer w-full max-md:h-32 h-48"
        onMouseDown={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rangeLen = localData.range.end - localData.range.start;
          const start =
            computeSampleIndex(e.nativeEvent.offsetX, rangeLen, canvas) +
            localData.range.start;
          selectRangeRef.current = { start, end: start };
          startSelectDrag(e.clientX);
        }}
        onMouseLeave={() => endSelectDrag()}
        onTouchStart={(e) => {
          if (e.touches.length !== 1 || isPinchingRef.current) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const offsetX =
            e.touches[0].clientX - canvas.getBoundingClientRect().left;
          const rangeLen = localData.range.end - localData.range.start;
          const start =
            computeSampleIndex(offsetX, rangeLen, canvas) +
            localData.range.start;
          selectRangeRef.current = { start, end: start };
          startSelectDrag(e.touches[0].clientX);
        }}
      ></canvas>
      {showHandles && (handlePositions || positionReference) && (
        <>
          <div className="absolute inset-x-0 top-0 max-md:h-32 h-48 pointer-events-none">
            {handlePositions && localData.section && (
              <>
                <SectionHandle
                  pct={handlePositions.startPct}
                  inBounds={handlePositions.startPct >= 0 && handlePositions.startPct <= 100}
                  onDragStart={(clientX) => {
                    draggingHandleRef.current = "start";
                    startHandleDrag(clientX);
                  }}
                />
                <SectionHandle
                  pct={handlePositions.endPct}
                  inBounds={handlePositions.endPct >= 0 && handlePositions.endPct <= 100}
                  onDragStart={(clientX) => {
                    draggingHandleRef.current = "end";
                    startHandleDrag(clientX);
                  }}
                />
              </>
            )}
            {positionReference && (
              <div
                ref={positionHandleRef}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 w-5 h-5.75 -translate-x-1/2 cursor-ew-resize rounded-sm bg-[#19CA93] border border-border [box-shadow:#FFFFFF80_0px_0px_3px_inset,#00000033_0px_2px_3px]"
                style={{ display: "none" }}
                onMouseDown={(e) => startPlayheadDrag(e.clientX)}
                onTouchStart={(e) => {
                  if (e.touches[0]) startPlayheadDrag(e.touches[0].clientX);
                }}
              />
            )}
          </div>
          <div
            className="relative w-full min-h-16 cursor-grab select-none flex items-center justify-center overflow-hidden bg-surface shadow-(--shadow-inset) border-t border-border"
            onMouseDown={(e) => {
              dragDistanceRef.current = 0;
              if (barContainerRef.current) {
                barContainerRef.current.style.transition = "none";
                barContainerRef.current.style.transform = "translateX(0)";
              }
              startPanDrag(e.clientX);
            }}
            onTouchStart={(e) => {
              if (e.touches[0] && !isPinchingRef.current) {
                dragDistanceRef.current = 0;
                if (barContainerRef.current) {
                  barContainerRef.current.style.transition = "none";
                  barContainerRef.current.style.transform = "translateX(0)";
                }
                startPanDrag(e.touches[0].clientX);
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

const SectionHandle: FC<{
  pct: number;
  inBounds: boolean;
  onDragStart: (clientX: number) => void;
}> = ({ pct, inBounds, onDragStart }) => (
  <div
    className={`pointer-events-auto drop-shadow-(--shadow-drop) absolute top-1/2 -translate-y-1/2 w-7 h-8 max-h-8 -translate-x-1/2 cursor-ew-resize rounded-sm bg-[#FDFDFD] border border-[#0000001A] [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] transition-opacity duration-200 ${inBounds ? "opacity-100" : "opacity-0"}`}
    style={{ left: `${pct}%` }}
    onMouseDown={(e) => onDragStart(e.clientX)}
    onTouchStart={(e) => {
      if (e.touches[0]) onDragStart(e.touches[0].clientX);
    }}
  />
);
