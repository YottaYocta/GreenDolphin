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
  renderWaveformFrame,
} from "../lib/waveform";
import { WaveformCanvas, type WaveformRenderFunction } from "./WaveformCanvas";
import { Button } from "./buttons";
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftCloseIcon,
  PanelRightCloseIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { MIN_RANGE_THRESHOLD } from "../lib/constants";
import { clampSection } from "../lib/util";

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
      position?: number
    ) => {
      renderWaveform(waveformData, { resolution: 10000 }, canvas, position);
    },
    []
  );

  const navigationRenderFunction: WaveformRenderFunction = useCallback(
    (
      waveformData: WaveformData,
      canvas: HTMLCanvasElement,
      position?: number
    ) => {
      renderWaveform(
        {
          ...waveformData,
          range: { start: 0, end: waveformData.data.length },
        },
        { resolution: 10000 },
        canvas,
        position
      );
      renderWaveformFrame(waveformData, localRange, canvas);
    },
    [localRange]
  );

  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(
      MIN_RANGE_THRESHOLD * (initialData.range.end - initialData.range.start)
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
      const targetSectionMinClamped = {
        start: Math.min(minSection.start, targetSection.start),
        end: Math.max(minSection.end, targetSection.end),
      };

      return clampSection(targetSectionMinClamped, {
        start: 0,
        end: initialData.data.length,
      });
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
        { start: 0, end: initialData.data.length }
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
        case "[":
          handleScrollLeft();
          break;
        case "]":
          handleScrollRight();
          break;
        case "Escape":
          e.preventDefault();
          handleClearSelection();
          break;
        case "H":
          handleBackUpSelection();
          break;
        case "L":
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
    <div className="relative w-full h-min flex flex-col gap-2">
      <div className="group flex flex-row gap-2 absolute top-1 right-1 z-10 w-min opacity-70 hover:opacity-100 focus:opacity-100 focus-within:opacity-100">
        <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
          <Button
            ariaLabel="zoom out"
            tooltip="zoom out ( j )"
            icon={<ZoomOutIcon width={18} height={18}></ZoomOutIcon>}
            onClick={handleZoomOut}
          ></Button>
          <Button
            ariaLabel="zoom in"
            icon={<ZoomInIcon width={18} height={18}></ZoomInIcon>}
            tooltip="zoom in ( k )"
            onClick={handleZoomIn}
          ></Button>
        </div>
        <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
          <Button
            ariaLabel="scroll left"
            tooltip="Scroll left ( [ )"
            icon={<ChevronLeftIcon width={18} height={18}></ChevronLeftIcon>}
            onClick={handleScrollLeft}
          ></Button>
          <Button
            ariaLabel="scroll right"
            tooltip="Scroll left ( ] )"
            icon={<ChevronRightIcon width={18} height={18}></ChevronRightIcon>}
            onClick={handleScrollRight}
          ></Button>
        </div>
      </div>
      {initialData.section ? (
        <div className="group flex flex-row gap-2 absolute top-1 left-1 z-10 w-min opacity-70 hover:opacity-100 focus:opacity-100 focus-within:opacity-100">
          <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
            <Button
              ariaLabel="Clear Selection"
              tooltip="Clear Selection ( Escape ) "
              icon={<BanIcon width={18} height={18}></BanIcon>}
              onClick={handleClearSelection}
            ></Button>
          </div>
          <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
            <Button
              icon={
                <PanelLeftCloseIcon width={18} height={18}></PanelLeftCloseIcon>
              }
              ariaLabel="Back Up Selection"
              tooltip="Back Up Selection ( H )"
              onClick={handleBackUpSelection}
            ></Button>
            <Button
              icon={
                <PanelRightCloseIcon
                  width={18}
                  height={18}
                ></PanelRightCloseIcon>
              }
              ariaLabel="Advance Selection"
              tooltip="Advance Selection ( L )"
              onClick={handleAdvanceSelection}
            ></Button>
          </div>
        </div>
      ) : (
        <></>
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
        className="border rounded-xs border-neutral-2 w-full"
        handleRangeChange={setLocalRange}
      ></WaveformCanvas>
      <WaveformCanvas
        waveformData={initialData}
        renderFunction={navigationRenderFunction}
        width={800}
        height={50}
        positionReference={positionReference}
        animate={animate}
        handlePosition={handlePosition}
        handleSelection={handleSelection}
        allowZoomPan={false}
        className="border rounded-xs border-neutral-2 w-full"
      ></WaveformCanvas>
    </div>
  );
};
