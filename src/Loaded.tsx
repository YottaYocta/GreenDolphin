import { useEffect, useRef, useState, type FC } from "react";
import { formatSeconds } from "./lib/util";
import { Button, ToggleButton } from "./components/buttons";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  GaugeIcon,
  MusicIcon,
  PlayIcon,
  RepeatIcon,
  SnowflakeIcon,
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

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

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
    <div className="w-full max-w-4xl h-min p-8 bg-white flex flex-col gap-16 border border-neutral-300 rounded-xs">
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
              icon={<ZoomInIcon width={18} height={18}></ZoomInIcon>}
            ></Button>
            <Button
              ariaLabel="zoom out"
              icon={<ZoomOutIcon width={18} height={18}></ZoomOutIcon>}
            ></Button>
          </div>
          <div className="flex border border-neutral-300 rounded-full p-1 items-center">
            <Button
              ariaLabel="zoom in"
              icon={<ChevronLeftIcon width={18} height={18}></ChevronLeftIcon>}
            ></Button>
            <Button
              ariaLabel="zoom out"
              icon={
                <ChevronRightIcon width={18} height={18}></ChevronRightIcon>
              }
            ></Button>
          </div>
        </div>
      </div>
      <div className="flex w-full justify-between items-center">
        <div className="flex items-center gap-2">
          <NumberInput
            icon={<MusicIcon width={18} height={18}></MusicIcon>}
            value={pitchShift}
            step={0.2}
            handleChange={(value) => setPitchShift(value)}
            for="pitch"
          />
          <NumberInput
            icon={<GaugeIcon width={18} height={18}></GaugeIcon>}
            value={playbackSpeed}
            step={0.1}
            min={0.1}
            max={3}
            handleChange={(value) => setPlaybackSpeed(value)}
            for="tempo"
          />
          <ToggleButton
            pressed={true}
            accent="positive"
            icon={<RepeatIcon width={18} height={18}></RepeatIcon>}
          ></ToggleButton>
        </div>
        <div className="flex justify-between items-center gap-2">
          <Button
            icon={<ChevronsLeftIcon width={18} height={18}></ChevronsLeftIcon>}
            text="5s"
            ariaLabel="rewind 5 seconds"
            className="border border-neutral-300 pr-3 pl-2"
          ></Button>
          <ToggleButton
            pressed={true}
            className="p-3"
            accent="negative"
            icon={<PlayIcon width={24} height={24}></PlayIcon>}
          ></ToggleButton>
          <ToggleButton
            pressed={true}
            className="p-3"
            accent="primary"
            icon={<SnowflakeIcon width={24} height={24}></SnowflakeIcon>}
          ></ToggleButton>

          <Button
            icon={
              <ChevronsRightIcon width={18} height={18}></ChevronsRightIcon>
            }
            text="5s"
            ariaLabel="rewind 5 seconds"
            className="border border-neutral-300 pr-2 pl-3"
            iconPlacement="right"
          ></Button>
        </div>
      </div>
    </div>
  );
};
