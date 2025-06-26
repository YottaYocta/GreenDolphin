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
  ChevronLeftIcon,
  ChevronRightIcon,
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
  handleSelection: (section: Section) => void;
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

  return (
    <div className="relative w-full h-min flex flex-col gap-2">
      <div className="group flex flex-row gap-2 absolute top-1 right-1 z-10 w-min opacity-70 hover:opacity-100 focus:opacity-100 focus-within:opacity-100">
        <div className="flex border border-neutral-2 hover:border-neutral-2 rounded-xs p-1 items-center opacity-70 bg-white group-hover:opacity-100 duration-75">
          <Button
            ariaLabel="zoom in"
            icon={<ZoomInIcon width={18} height={18}></ZoomInIcon>}
            onClick={() => {
              setLocalRange((prevRange) => {
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
                  end: initialData.data.length,
                });
              });
            }}
          ></Button>
          <Button
            ariaLabel="zoom out"
            icon={<ZoomOutIcon width={18} height={18}></ZoomOutIcon>}
            onClick={() => {
              setLocalRange((prevRange) => {
                const scrollAmount = Math.floor(
                  (prevRange.end - prevRange.start) * 0.1
                );
                return clampSection(
                  {
                    start: prevRange.start - scrollAmount,
                    end: prevRange.end + scrollAmount,
                  },
                  { start: 0, end: initialData.data.length }
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
              setLocalRange((prevRange) => {
                const shiftAmount = Math.floor(
                  (prevRange.end - prevRange.start) * 0.1
                );
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
            }}
          ></Button>
          <Button
            ariaLabel="scroll right"
            icon={<ChevronRightIcon width={18} height={18}></ChevronRightIcon>}
            onClick={() => {
              setLocalRange((prevRange) => {
                const shiftAmount = Math.floor(
                  (prevRange.end - prevRange.start) * 0.1
                );
                const targetRange = {
                  start: prevRange.start + shiftAmount,
                  end: prevRange.end + shiftAmount,
                };
                if (targetRange.end > initialData.data.length) {
                  return {
                    start:
                      initialData.data.length -
                      (prevRange.end - prevRange.start),
                    end: initialData.data.length,
                  };
                } else return targetRange;
              });
            }}
          ></Button>
        </div>
      </div>
      <WaveformCanvas
        waveformData={{ ...initialData, range: localRange }}
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
