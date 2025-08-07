import { useCallback, useContext, useEffect, useState, type FC } from "react";
import { formatSeconds } from "./lib/util";
import { Button, ToggleButton } from "./components/buttons";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  GaugeIcon,
  MegaphoneIcon,
  MusicIcon,
  PlayIcon,
  SnowflakeIcon,
} from "lucide-react";
import { FrequencyCanvas } from "./components/FrequencyCanvas";
import { PlaybackContext } from "./PlaybackContext";
import { WaveformView } from "./components/WaveformView";
import { SliderInput } from "./components/SliderInput";

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
    gain,
    setGain,
  } = playback;

  const [renderedGain, setRenderedGain] = useState<number>(1);

  useEffect(() => {
    setGain(renderedGain * renderedGain);
  }, [renderedGain, setGain]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "0") {
        const currentStart = loop ? loop.start : 0;
        setPosition(currentStart);
        setPlayState("playing");
      } else if (e.key === "p") {
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
      }

      // else if (e.key === "l") {
      //   setLooping(!looping);
      // }
    };
    window.addEventListener("keypress", handleKey);
    return () => {
      window.removeEventListener("keypress", handleKey);
    };
  }, [loop, looping, playState, setLooping, setPlayState, setPosition]);

  const rewindFiveSeconds = useCallback(() => {
    const targetMS = Math.max(0, playbackPosition.current - 5000);
    setPosition(targetMS);
  }, [playbackPosition, setPosition]);

  const fastForwardFiveSeconds = useCallback(() => {
    const targetMS = Math.max(0, playbackPosition.current + 5000);
    setPosition(targetMS);
  }, [playbackPosition, setPosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "h") {
        rewindFiveSeconds();
      } else if (e.key === "l") {
        fastForwardFiveSeconds();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rewindFiveSeconds, fastForwardFiveSeconds]);

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
    <div className="w-full max-w-[800px] h-screen sm:h-full md:h-min p-4 md:p-6 bg-white flex flex-col justify-center gap-4 sm:border sm:border-neutral-2 sm:rounded-xs sm:shadow-md">
      <div className="w-full flex justify-between items-baseline border-b border-neutral-2">
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {filename}
        </p>
        <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
          {formatSeconds(data.duration)}
        </p>
      </div>
      <div className="w-full flex flex-col gap-4">
        <FrequencyCanvas></FrequencyCanvas>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <WaveformView
              initialData={{
                data: data,
                range: { start: 0, end: data.length },
                section: loop,
              }}
              positionReference={playbackPosition}
              animate={playState === "playing" || triggerUpdate}
              handlePosition={handlePosition}
              handleSelection={(section) => {
                setLoop(section);
              }}
            ></WaveformView>
          </div>
        </div>
        <div className="flex flex-col sm:gap-12 gap-8 md:flex-row w-full sm:h-full h-min justify-between items-center p-4 sm:p-8">
          <div
            className="w-full h-full flex flex-col items-center sm:gap-6 gap-2 justify-center"
            id="recording-properties"
          >
            <SliderInput
              icon={<MusicIcon width={18} height={18}></MusicIcon>}
              value={pitchShift}
              defaultValue={0}
              step={0.2}
              min={-10}
              max={10}
              handleChange={(value) =>
                setPitchShift(Math.round(value * 10) / 10)
              }
              for="Pitch"
              valueRenderer={(currentValue) => `${currentValue} smt.`}
            />
            <SliderInput
              icon={<GaugeIcon width={18} height={18}></GaugeIcon>}
              value={playbackSpeed}
              defaultValue={1}
              step={0.1}
              min={0.1}
              max={1.9}
              handleChange={(value) =>
                setPlaybackSpeed(Math.round(value * 10) / 10)
              }
              for="Speed"
              valueRenderer={(currentValue) => `${currentValue.toFixed(2)} x`}
            />
            <SliderInput
              icon={<MegaphoneIcon width={18} height={18}></MegaphoneIcon>}
              value={renderedGain}
              defaultValue={1}
              step={0.1}
              min={0}
              max={2}
              handleChange={(value) => {
                setRenderedGain(Math.round(value * 10) / 10);
              }}
              for="Volume"
              valueRenderer={() => `${(gain * gain).toFixed(1)} db`}
            />
          </div>
          <div
            className="flex md:flex-col flex-row justify-between items-center gap-2"
            id="playback-controls"
          >
            <div className="w-full flex gap-2 items-center justify-center">
              <ToggleButton
                pressed={playState === "playing"}
                onClick={() => {
                  if (playState === "playing") setPlayState("paused");
                  else setPlayState("playing");
                }}
                accent="negative"
                icon={
                  <PlayIcon width={22} height={22} strokeWidth={1.5}></PlayIcon>
                }
                ariaLabel="play/pause"
                tooltip="Play/Pause ( p )"
                className="play-button"
                id="play"
              ></ToggleButton>
              <ToggleButton
                pressed={playState === "frozen"}
                onClick={() => {
                  if (playState === "frozen") setPlayState("paused");
                  else {
                    setPlayState("frozen");
                  }
                }}
                accent="primary"
                icon={
                  <SnowflakeIcon
                    width={24}
                    height={24}
                    strokeWidth={1.5}
                  ></SnowflakeIcon>
                }
                ariaLabel="freeze"
                tooltip="Freeze in Place ( f )"
                className="play-button"
                id="freeze"
              ></ToggleButton>
            </div>
            <div className="w-full flex justify-center items-center gap-2">
              <Button
                icon={
                  <ChevronsLeftIcon width={18} height={18}></ChevronsLeftIcon>
                }
                tooltip="Rewind 5s ( h )"
                text="5s"
                ariaLabel="rewind 5 seconds"
                className="play-button border border-neutral-2"
                onClick={rewindFiveSeconds}
                id="rewind"
              ></Button>
              <Button
                icon={
                  <ChevronsRightIcon width={18} height={18}></ChevronsRightIcon>
                }
                tooltip="Fast Forward 5s ( l )"
                text="5s"
                ariaLabel="fast forward 5 seconds"
                className="play-button flex-1 border border-neutral-2"
                iconPlacement="right"
                onClick={fastForwardFiveSeconds}
                id="fast-forward"
              ></Button>
            </div>
            {/* <ToggleButton
              pressed={looping}
              accent="positive"
              icon={<RepeatIcon width={18} height={18}></RepeatIcon>}
              onClick={() => {
                setLooping(!looping);
              }}
              ariaLabel="loop playback"
              text={looping ? "Looping" : "Not Looping"}
              tooltip="Toggle Loop (l)"
              className="h-10 min-h-10 min-w-full w-full justify-center"
            ></ToggleButton> */}
          </div>
        </div>
      </div>
    </div>
  );
};
