import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
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
import { type WaveformData } from "./lib/waveform";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { PlaybackContext } from "./PlaybackContext";

export interface LoadedProps {
  data: AudioBuffer;
  filename: string;
}

export const Loaded: FC<LoadedProps> = ({ data, filename }) => {
  const waveformRef = useRef<HTMLCanvasElement>(null);

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [triggerUpdate, setTriggerUpdate] = useState<boolean>(false);

  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("Loaded must be used within a PlaybackProvider");
  }
  const {
    playbackPosition,
    playState,
    start,
    pause,
    freeze,
    setPosition,
    looping,
    setLooping,
  } = playback;

  const [largeWaveformRange, setLargeWaveformRange] = useState({
    start: 0,
    end: data.length,
  });

  useEffect(
    () => setLargeWaveformRange({ start: 0, end: data.length }),
    [data]
  );

  const navWaveformData: WaveformData = useMemo(() => {
    return {
      data: data,
      section: largeWaveformRange,
      range: { start: 0, end: data.length },
    };
  }, [data, largeWaveformRange]);

  const handlePosition = (sampleIndex: number) => {
    const timeInSeconds = sampleIndex / data.sampleRate;
    const timeInMs = timeInSeconds * 1000;
    playbackPosition.current = Math.max(
      0,
      Math.min(timeInMs, data.duration * 1000)
    );
    setTriggerUpdate(true);
    setPosition(timeInMs);
  };

  useEffect(() => {
    if (triggerUpdate) setTriggerUpdate(false);
  }, [triggerUpdate]);

  return (
    <div className="w-full max-w-4xl h-full md:h-min p-4 py-8 md:p-8 bg-white flex flex-col justify-center gap-16 border border-neutral-300 rounded-xs">
      <div className="w-full flex justify-between items-baseline border-b border-neutral-300 py-2">
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {filename}
        </p>
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {formatSeconds(data.duration)}
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
            waveformData={{ data: data, range: { start: 0, end: data.length } }}
            width={800}
            height={200}
            positionReference={playbackPosition}
            animate={playState === "playing" || triggerUpdate}
            handlePosition={handlePosition}
            handleRangeChange={(newRange) => {
              setLargeWaveformRange(newRange);
            }}
            className="border rounded-xs border-neutral-300 w-full"
          ></WaveformCanvas>
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <WaveformCanvas
              waveformData={navWaveformData}
              width={800}
              height={50}
              positionReference={playbackPosition}
              animate={playState === "playing" || triggerUpdate}
              handlePosition={handlePosition}
              allowZoomPan={false}
              className="border rounded-xs border-neutral-300 w-full"
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
                if (playState === "playing") pause();
                else start();
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
                if (playState === "frozen") pause();
                else freeze();
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
