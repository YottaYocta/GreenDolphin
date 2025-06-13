import { useMemo, useRef, useState, type FC } from "react";
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
import { type WaveformData } from "./lib/waveform";
import { WaveformCanvas } from "./components/WaveformCanvas";

interface LoadedProps {
  state: AppState;
}

export const Loaded: FC<LoadedProps> = ({ state }) => {
  const waveformRef = useRef<HTMLCanvasElement>(null);

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [playState, setPlayState] = useState<"playing" | "paused" | "frozen">(
    "paused"
  );
  const [looping, setLooping] = useState<boolean>(true);

  const largeWaveformData: WaveformData = useMemo(() => {
    return {
      data: state.data,
      range: { start: 0, end: state.data.length },
    };
  }, [state.data]);

  return (
    <div className="w-full max-w-4xl h-full md:h-min p-4 py-8 md:p-8 bg-white flex flex-col justify-center gap-16 border border-neutral-300 rounded-xs">
      <div className="w-full flex justify-between items-baseline border-b border-neutral-300 py-2">
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {state.filename}
        </p>
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {formatSeconds(state.data.duration)}
        </p>
      </div>
      <div className="w-full flex flex-col gap-16 md:gap-24">
        <canvas
          width={800}
          height={100}
          ref={waveformRef}
          className="border rounded-xs border-neutral-300 pixelated w-full"
        ></canvas>
        <div className="flex flex-col gap-2">
          <WaveformCanvas
            waveformData={largeWaveformData}
            width={800}
            height={200}
            className="border rounded-xs border-neutral-300 pixelated w-full"
          ></WaveformCanvas>
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <WaveformCanvas
              waveformData={largeWaveformData}
              width={800}
              height={50}
              allowZoomPan={false}
              className="border rounded-xs border-neutral-300 pixelated w-full"
            ></WaveformCanvas>
            <div className="flex flex-row gap-2">
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
                  icon={
                    <ChevronLeftIcon width={18} height={18}></ChevronLeftIcon>
                  }
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
        </div>
        <div className="flex flex-col gap-8 md:flex-row w-full justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-2 md:flex-row">
              <NumberInput
                icon={
                  <MusicIcon
                    width={18}
                    height={18}
                    className="text-neutral-500"
                  ></MusicIcon>
                }
                value={pitchShift}
                step={0.2}
                handleChange={(value) => setPitchShift(value)}
                for="pitch"
              />
              <NumberInput
                icon={
                  <GaugeIcon
                    width={18}
                    height={18}
                    className="text-neutral-500"
                  ></GaugeIcon>
                }
                value={playbackSpeed}
                step={0.1}
                min={0.1}
                max={3}
                handleChange={(value) => setPlaybackSpeed(value)}
                for="tempo"
              />
            </div>
            <ToggleButton
              pressed={looping}
              accent="positive"
              icon={<RepeatIcon width={18} height={18}></RepeatIcon>}
              onClick={() => {
                setLooping(!looping);
              }}
              ariaLabel="loop playback"
            ></ToggleButton>
          </div>
          <div className="flex justify-between items-center gap-2">
            <Button
              icon={
                <ChevronsLeftIcon width={18} height={18}></ChevronsLeftIcon>
              }
              text="5s"
              ariaLabel="rewind 5 seconds"
              className="border border-neutral-300 pr-3 pl-2"
            ></Button>
            <ToggleButton
              pressed={playState === "playing"}
              onClick={() => {
                if (playState === "playing") setPlayState("paused");
                else setPlayState("playing");
              }}
              className="p-3"
              accent="negative"
              icon={
                <PlayIcon width={22} height={22} strokeWidth={1.5}></PlayIcon>
              }
              ariaLabel="play/pause"
            ></ToggleButton>
            <ToggleButton
              pressed={playState === "frozen"}
              onClick={() => {
                if (playState === "frozen") setPlayState("paused");
                else setPlayState("frozen");
              }}
              className="p-3"
              accent="primary"
              icon={
                <SnowflakeIcon
                  width={24}
                  height={24}
                  strokeWidth={1.5}
                ></SnowflakeIcon>
              }
              ariaLabel="freeze"
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
    </div>
  );
};
