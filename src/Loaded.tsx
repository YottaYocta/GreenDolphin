import { useContext, useEffect, useMemo, useState, type FC } from "react";
import { formatSeconds } from "./lib/util";
import { Button, ToggleButton } from "./components/buttons";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  GaugeIcon,
  MusicIcon,
  PlayIcon,
  RepeatIcon,
  SnowflakeIcon,
} from "lucide-react";
import { NumberInput } from "./components/NumberInput";
import { type WaveformData } from "./lib/waveform";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { FrequencyCanvas } from "./components/FrequencyCanvas";
import { PlaybackContext } from "./PlaybackContext";

export interface LoadedProps {
  data: AudioBuffer;
  filename: string;
}

export const Loaded: FC<LoadedProps> = ({ data, filename }) => {
  const [triggerUpdate, setTriggerUpdate] = useState<boolean>(false);

  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("Loaded must be used within a PlaybackProvider");
  }
  const {
    playbackPosition,
    playState,
    setPlayState,
    setPosition,
    loop,
    looping,
    setLooping,
    setLoop,
    pitchShift,
    setPitchShift,
    playbackSpeed,
    setPlaybackSpeed,
  } = playback;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "p") {
        if (playState === "paused") {
          setPlayState("playing");
        } else if (playState === "frozen") {
          setPlayState("playing");
        } else {
          setPlayState("paused");
        }
      } else if (e.key === "f") {
        if (playState === "frozen") setPlayState("paused");
        else setPlayState("frozen");
      } else if (e.key === "l") {
        setLooping(!looping);
      }
    };
    window.addEventListener("keypress", handleKey);
    return () => {
      window.removeEventListener("keypress", handleKey);
    };
  }, [looping, playState, setLooping, setPlayState]);

  const navWaveformData: WaveformData = useMemo(() => {
    return {
      data: data,
      section: loop,
      range: { start: 0, end: data.length },
    };
  }, [data, loop]);

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
    <div className="w-full max-w-[800px] h-full md:h-min p-4 py-8 md:p-8 bg-white flex flex-col justify-center gap-16 border border-neutral-2 rounded-xs shadow-md">
      <div className="w-full flex justify-between items-baseline border-b border-neutral-2 py-2">
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {filename}
        </p>
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {formatSeconds(data.duration)}
        </p>
      </div>
      <div className="w-full flex flex-col gap-6 md:gap-16">
        <FrequencyCanvas></FrequencyCanvas>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <div className="h-6">
              {loop ? (
                <Button
                  text="Clear Selection"
                  onClick={() => {
                    setLoop(undefined);
                  }}
                  className="text-sm px-0 py-0 text-neutral-500 hover:text-neutral-800 hover:bg-white hover:underline"
                ></Button>
              ) : (
                <></>
              )}
            </div>
            <WaveformCanvas
              waveformData={{
                data: data,
                range: { start: 0, end: data.length },
                section: loop,
              }}
              width={800}
              height={200}
              positionReference={playbackPosition}
              animate={playState === "playing" || triggerUpdate}
              handlePosition={handlePosition}
              handleSelection={(section) => {
                setLoop(section);
                handlePosition(
                  Math.min(Math.max(0, section.start), data.length)
                );
              }}
              className="border rounded-xs border-neutral-2 w-full"
            ></WaveformCanvas>
          </div>
          <WaveformCanvas
            waveformData={navWaveformData}
            width={800}
            height={50}
            positionReference={playbackPosition}
            animate={playState === "playing" || triggerUpdate}
            handlePosition={handlePosition}
            handleSelection={(section) => {
              setLoop(section);
              handlePosition(Math.min(Math.max(0, section.start), data.length));
            }}
            allowZoomPan={false}
            className="border rounded-xs border-neutral-2 w-full"
          ></WaveformCanvas>
        </div>
        <div className="flex flex-col gap-8 md:flex-row w-full justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-2 md:flex-row">
              <NumberInput
                icon={<MusicIcon width={18} height={18}></MusicIcon>}
                value={pitchShift}
                defaultValue={0}
                step={0.2}
                handleChange={(value) =>
                  setPitchShift(Math.round(value * 10) / 10)
                }
                for="pitch"
              />
              <NumberInput
                icon={<GaugeIcon width={18} height={18}></GaugeIcon>}
                value={playbackSpeed}
                defaultValue={1}
                step={0.1}
                min={0.1}
                max={3}
                handleChange={(value) =>
                  setPlaybackSpeed(Math.round(value * 10) / 10)
                }
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
              tooltip="Toggle Loop (l)"
            ></ToggleButton>
          </div>
          <div className="flex justify-between items-center gap-2">
            <Button
              icon={
                <ChevronsLeftIcon width={18} height={18}></ChevronsLeftIcon>
              }
              text="5s"
              ariaLabel="rewind 5 seconds"
              className="border border-neutral-2 pr-3 pl-2"
              onClick={() => {
                const targetMS = Math.max(0, playbackPosition.current - 5000);
                setPosition(targetMS);
              }}
            ></Button>
            <ToggleButton
              pressed={playState === "playing"}
              onClick={() => {
                if (playState === "playing") setPlayState("paused");
                else setPlayState("playing");
              }}
              className="md:p-4 p-3"
              accent="negative"
              icon={
                <PlayIcon width={22} height={22} strokeWidth={1.5}></PlayIcon>
              }
              ariaLabel="play/pause"
              tooltip="Play/Pause (p)"
            ></ToggleButton>
            <ToggleButton
              pressed={playState === "frozen"}
              onClick={() => {
                if (playState === "frozen") setPlayState("paused");
                else {
                  setPlayState("frozen");
                }
              }}
              className="md:p-4 p-3"
              accent="primary"
              icon={
                <SnowflakeIcon
                  width={24}
                  height={24}
                  strokeWidth={1.5}
                ></SnowflakeIcon>
              }
              ariaLabel="freeze"
              tooltip="Freeze in Place (f)"
            ></ToggleButton>

            <Button
              icon={
                <ChevronsRightIcon width={18} height={18}></ChevronsRightIcon>
              }
              text="5s"
              ariaLabel="fast forward5 seconds"
              className="border border-neutral-2 pr-2 pl-3"
              iconPlacement="right"
              onClick={() => {
                const targetMS = Math.max(0, playbackPosition.current + 5000);
                setPosition(targetMS);
              }}
            ></Button>
          </div>
        </div>
      </div>
    </div>
  );
};
