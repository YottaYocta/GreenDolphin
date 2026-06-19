import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type RefObject,
} from "react";
import { XCircleIcon, ArrowSquareLeftIcon } from "@phosphor-icons/react";
import {
  type WaveformData,
  type Section,
  renderWaveform,
} from "../lib/waveform";
import { WaveformCanvas, type WaveformRenderFunction } from "./WaveformCanvas";
import { MIN_RANGE_THRESHOLD } from "../lib/constants";
import { clampSection } from "../lib/util";

export interface WaveformViewProps {
  initialData: WaveformData;
  positionReference: RefObject<number>;
  animate: boolean;
  handlePosition: (sampleIndex: number) => void;
  handleSelection: (section: Section | undefined) => void;
  initialRange?: Section;
  onRangeChange?: (range: Section) => void;
}

export const WaveformView: FC<WaveformViewProps> = ({
  initialData,
  positionReference,
  animate,
  handlePosition,
  handleSelection,
  initialRange,
  onRangeChange,
}) => {
  const [localRange, setLocalRange] = useState<Section>(
    initialRange ?? { start: 0, end: initialData.data.length },
  );

  const setLocalRangeAndNotify = useCallback(
    (range: Section | ((prev: Section) => Section)) => {
      setLocalRange((prev) => {
        const next = typeof range === "function" ? range(prev) : range;
        onRangeChange?.(next);
        return next;
      });
    },
    [onRangeChange],
  );


  const viewportRenderFunction: WaveformRenderFunction = useCallback(
    (
      waveformData: WaveformData,
      canvas: HTMLCanvasElement,
      position?: number,
    ) => {
      renderWaveform(waveformData, { resolution: 10000 }, canvas, position);
    },
    [],
  );

  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(
      MIN_RANGE_THRESHOLD * (initialData.range.end - initialData.range.start),
    );
    return value;
  }, [initialData.range.end, initialData.range.start]);

  const handleZoomIn = useCallback(() => {
    setLocalRangeAndNotify((prevRange) => {
      const zoomAmount = Math.floor((prevRange.end - prevRange.start) * 0.1);
      const targetSection = {
        start: prevRange.start + zoomAmount,
        end: prevRange.end - zoomAmount,
      };
      const midPoint =
        Math.floor((prevRange.end - prevRange.start) / 2) + prevRange.start;
      const minSection = {
        start: Math.floor(midPoint - minRangeThresholdValue / 2),
        end: Math.floor(midPoint + minRangeThresholdValue / 2),
      };
      return clampSection(
        {
          start: Math.min(minSection.start, targetSection.start),
          end: Math.max(minSection.end, targetSection.end),
        },
        { start: 0, end: initialData.data.length },
      );
    });
  }, [initialData.data.length, minRangeThresholdValue, setLocalRangeAndNotify]);

  const handleZoomOut = useCallback(() => {
    setLocalRangeAndNotify((prevRange) => {
      const scrollAmount = Math.floor((prevRange.end - prevRange.start) * 0.1);
      return clampSection(
        {
          start: prevRange.start - scrollAmount,
          end: prevRange.end + scrollAmount,
        },
        { start: 0, end: initialData.data.length },
      );
    });
  }, [initialData.data.length, setLocalRangeAndNotify]);

  const handleScrollLeft = useCallback(() => {
    setLocalRangeAndNotify((prevRange) => {
      const shiftAmount = Math.floor((prevRange.end - prevRange.start) * 0.1);
      const targetRange = {
        start: prevRange.start - shiftAmount,
        end: prevRange.end - shiftAmount,
      };
      if (targetRange.start < 0) {
        return {
          start: 0,
          end: prevRange.end - prevRange.start,
        };
      } else return targetRange;
    });
  }, [setLocalRangeAndNotify]);

  const handleScrollRight = useCallback(() => {
    setLocalRangeAndNotify((prevRange) => {
      const shiftAmount = Math.floor((prevRange.end - prevRange.start) * 0.1);
      const targetRange = {
        start: prevRange.start + shiftAmount,
        end: prevRange.end + shiftAmount,
      };
      if (targetRange.end > initialData.data.length) {
        return {
          start: initialData.data.length - (prevRange.end - prevRange.start),
          end: initialData.data.length,
        };
      } else return targetRange;
    });
  }, [initialData.data.length, setLocalRangeAndNotify]);

  const handleClearSelection = useCallback(() => {
    handleSelection(undefined);
  }, [handleSelection]);

  const handleBackUpSelection = useCallback(() => {
    if (initialData.section) {
      const sectionRange = initialData.section.end - initialData.section.start;
      const targetStart = initialData.section.start - sectionRange;
      const clampedStart = Math.max(targetStart, 0);
      const targetEnd = clampedStart + sectionRange;
      const clampedEnd = Math.min(initialData.data.length, targetEnd);
      handleSelection({ start: clampedStart, end: clampedEnd });
    }
  }, [initialData.section, initialData.data.length, handleSelection]);

  const handleAdvanceSelection = useCallback(() => {
    if (initialData.section) {
      const sectionRange = initialData.section.end - initialData.section.start;
      const targetEnd = initialData.section.end + sectionRange;
      const clampedEnd = Math.min(targetEnd, initialData.data.length);
      const targetStart = clampedEnd - sectionRange;
      const clampedStart = Math.max(0, targetStart);
      handleSelection({ start: clampedStart, end: clampedEnd });
    }
  }, [initialData.section, initialData.data.length, handleSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { key } = e;
      switch (key) {
        case "j":
          handleZoomOut();
          break;
        case "k":
          handleZoomIn();
          break;
        case "H":
          handleScrollLeft();
          break;
        case "L":
          handleScrollRight();
          break;
        case "Escape":
          e.preventDefault();
          handleClearSelection();
          break;
        case "[":
          handleBackUpSelection();
          break;
        case "]":
          handleAdvanceSelection();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleZoomIn,
    handleZoomOut,
    handleScrollLeft,
    handleScrollRight,
    handleClearSelection,
    handleBackUpSelection,
    handleAdvanceSelection,
  ]);

  return (
    <div
      className="relative w-full h-min flex flex-col gap-2 max-md:grow"
      id="waveform-view"
    >
      {initialData.section && (
        <div className="flex absolute top-2.25 left-2.75 z-10 items-center gap-4 p-2 rounded-lg bg-white border border-[#0000001A]">
          <button
            onClick={handleClearSelection}
            title="Clear Selection (Escape)"
            aria-label="Clear Selection"
            className="cursor-pointer hover:opacity-70"
          >
            <XCircleIcon
              size={24}
              weight="fill"
              color="var(--color-icon-subtle)"
            />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackUpSelection}
              title="Back Up Selection ([)"
              aria-label="Back Up Selection"
              className="cursor-pointer hover:opacity-70"
            >
              <ArrowSquareLeftIcon
                size={24}
                weight="fill"
                color="var(--color-icon-subtle)"
              />
            </button>
            <button
              onClick={handleAdvanceSelection}
              title="Advance Selection (])"
              aria-label="Advance Selection"
              className="cursor-pointer hover:opacity-70"
            >
              <ArrowSquareLeftIcon
                size={24}
                weight="fill"
                color="var(--color-icon-subtle)"
                style={{ transform: "scaleX(-1)" }}
              />
            </button>
          </div>
        </div>
      )}
      <WaveformCanvas
        waveformData={{
          ...initialData,
          range: localRange,
        }}
        renderFunction={viewportRenderFunction}
        width={800}
        height={200}
        positionReference={positionReference}
        animate={animate}
        handlePosition={handlePosition}
        handleSelection={handleSelection}
        handleRangeChange={setLocalRangeAndNotify}
        showHandles={true}
      />
    </div>
  );
};
