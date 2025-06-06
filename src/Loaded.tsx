import { useEffect, useRef, type FC } from "react";
import { formatSeconds } from "./lib/util";
import { Button } from "./components/buttons";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GaugeIcon,
  MusicIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { NumberInput } from "./components/NumberInput";
import type { AppState } from "./lib/types";
import { renderWaveform } from "./lib/waveform";

interface LoadedProps {
  state: AppState;
}

export const Loaded: FC<LoadedProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const range = { start: 0, end: state.data.length };
      renderWaveform(
        { data: state.data, range: range },
        { resolution: 10000 },
        canvasRef.current
      );
    }
  }, [state.data]);

  return (
    <div className="w-full max-w-3xl h-min p-8 bg-white flex flex-col gap-16 border border-neutral-300 rounded-xs">
      <div className="w-full flex justify-between items-baseline border-b border-neutral-300">
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {state.filename}
        </p>
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {formatSeconds(state.data.duration)}
        </p>
      </div>
      <canvas
        width={800}
        height={100}
        ref={waveformRef}
        className="border rounded-xs border-neutral-300 pixelated w-full"
      ></canvas>
      <div className="flex flex-col gap-2">
        <canvas
          width={800}
          height={200}
          ref={canvasRef}
          className="border rounded-xs border-neutral-300 pixelated w-full"
        ></canvas>
        <div className="flex gap-2 items-center">
          <canvas
            width={800}
            height={50}
            ref={navCanvasRef}
            className="border rounded-xs border-neutral-300 pixelated w-full"
          ></canvas>
          <div className="flex border border-neutral-300 rounded-full p-1 items-center">
            <Button
              ariaLabel="zoom in"
              icon={
                <ZoomInIcon
                  strokeWidth={1.5}
                  width={18}
                  height={18}
                  className="stroke-neutral-500"
                ></ZoomInIcon>
              }
            ></Button>
            <Button
              ariaLabel="zoom out"
              icon={
                <ZoomOutIcon
                  strokeWidth={1.5}
                  width={18}
                  height={18}
                  className="stroke-neutral-500"
                ></ZoomOutIcon>
              }
            ></Button>
          </div>
          <div className="flex border border-neutral-300 rounded-full p-1 items-center">
            <Button
              ariaLabel="zoom in"
              icon={
                <ChevronLeftIcon
                  strokeWidth={1.5}
                  width={18}
                  height={18}
                  className="stroke-neutral-500"
                ></ChevronLeftIcon>
              }
            ></Button>
            <Button
              ariaLabel="zoom out"
              icon={
                <ChevronRightIcon
                  strokeWidth={1.5}
                  width={18}
                  height={18}
                  className="stroke-neutral-500"
                ></ChevronRightIcon>
              }
            ></Button>
          </div>
        </div>
      </div>
      <div className="flex w-full justify-between items-center">
        <div className="flex items-center gap-2">
          <NumberInput
            icon={
              <MusicIcon
                strokeWidth={1.5}
                width={18}
                height={18}
                className="stroke-neutral-500"
              ></MusicIcon>
            }
            defaultValue={0}
            step={0.2}
            handleChange={(value) => console.log("NumberInput value:", value)}
            for="pitch"
          />
          <NumberInput
            icon={
              <GaugeIcon
                strokeWidth={1.5}
                width={18}
                height={18}
                className="stroke-neutral-500"
              ></GaugeIcon>
            }
            defaultValue={1}
            step={0.1}
            min={0.1}
            max={3}
            handleChange={(value) => console.log("NumberInput value:", value)}
            for="tempo"
          />
        </div>
      </div>
    </div>
  );
};
