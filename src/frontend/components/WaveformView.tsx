import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type RefObject,
} from "react";
import {
  type WaveformData,
  type Section,
  renderWaveform,
} from "../lib/waveform";
import { WaveformCanvas, type WaveformRenderFunction } from "./WaveformCanvas";
import { MIN_RANGE_THRESHOLD } from "../lib/constants";
import { clampSection } from "../lib/util";

const iconStyle = {
  width: 20,
  height: 20,
  overflow: "visible",
  flexShrink: 0,
} as const;

export interface WaveformViewProps {
  initialData: WaveformData;
  positionReference: RefObject<number>;
  animate: boolean;
  handlePosition: (sampleIndex: number) => void;
  handleSelection: (section: Section | undefined) => void;
}

export const WaveformView: FC<WaveformViewProps> = ({
  initialData,
  positionReference,
  animate,
  handlePosition,
  handleSelection,
}) => {
  const [localRange, setLocalRange] = useState<Section>({
    start: 0,
    end: initialData.data.length,
  });

  useEffect(() => {
    setLocalRange({
      start: 0,
      end: initialData.data.length,
    });
  }, [initialData.data.length]);

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
    setLocalRange((prevRange) => {
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
  }, [initialData.data.length, minRangeThresholdValue]);

  const handleZoomOut = useCallback(() => {
    setLocalRange((prevRange) => {
      const scrollAmount = Math.floor((prevRange.end - prevRange.start) * 0.1);
      return clampSection(
        {
          start: prevRange.start - scrollAmount,
          end: prevRange.end + scrollAmount,
        },
        { start: 0, end: initialData.data.length },
      );
    });
  }, [initialData.data.length]);

  const handleScrollLeft = useCallback(() => {
    setLocalRange((prevRange) => {
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
  }, []);

  const handleScrollRight = useCallback(() => {
    setLocalRange((prevRange) => {
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
  }, [initialData.data.length]);

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
        <div className="flex absolute top-2.25 left-2.75  items-center gap-4 p-2 rounded-lg bg-white border border-[#0000001A]">
          <button
            onClick={handleClearSelection}
            title="Clear Selection (Escape)"
            aria-label="Clear Selection"
            className="cursor-pointer hover:opacity-70"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 256 256"
              style={iconStyle}
            >
              <path
                d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
                fill="#525252"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackUpSelection}
              title="Back Up Selection ([)"
              aria-label="Back Up Selection"
              className="cursor-pointer hover:opacity-70"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 256 256"
                style={iconStyle}
              >
                <path
                  d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H107.31l18.35,18.34a8,8,0,0,1-11.32,11.32l-32-32a8,8,0,0,1,0-11.32l32-32a8,8,0,0,1,11.32,11.32L107.31,120H168a8,8,0,0,1,0,16Z"
                  fill="#525252"
                />
              </svg>
            </button>
            <button
              onClick={handleAdvanceSelection}
              title="Advance Selection (])"
              aria-label="Advance Selection"
              className="cursor-pointer hover:opacity-70"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 256 256"
                style={{
                  ...iconStyle,
                  rotate: "180deg",
                  transformOrigin: "50% 50%",
                }}
              >
                <path
                  d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H107.31l18.35,18.34a8,8,0,0,1-11.32,11.32l-32-32a8,8,0,0,1,0-11.32l32-32a8,8,0,0,1,11.32,11.32L107.31,120H168a8,8,0,0,1,0,16Z"
                  fill="#525252"
                />
              </svg>
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
        handleRangeChange={setLocalRange}
        showHandles={true}
      />
    </div>
  );
};
