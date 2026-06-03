import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type RefObject,
} from "react";
import { useNavigate } from "react-router";
import { Tutorial } from "./components/Tutorial";
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
import { PianoRoll } from "./components/PianoRoll";
import { PlaybackContext } from "./playback/PlaybackContext";
import { WaveformView } from "./components/WaveformView";
import { SliderInput } from "./components/SliderInput";
import { AudioStore } from "./AudioStore";

export const Loaded = () => {
  const { audio } = useContext(AudioStore);
  if (!audio) throw new Error("Loaded must be rendered within an audio route");
  const { buffer: data, filename } = audio;
  const navigate = useNavigate();

  const [showTutorial, setShowTutorial] = useState(
    localStorage.getItem("tutorial_shown") !== "true",
  );
  // acquiring wake lock to prevent screen from falling asleep

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockStatus, setWakeLockStatus] = useState<
    "Requesting Keep Awake" | "Keep Awake Error" | "Keep Awake Active"
  >("Keep Awake Active");

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        setWakeLockStatus("Requesting Keep Awake");
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        setWakeLockStatus("Keep Awake Active");
      } catch (e: unknown) {
        console.log(e);
        setWakeLockStatus("Keep Awake Error");
      }
    };

    const disableWakeLock = () => {
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release();
      }
    };
    requestWakeLock();
    return disableWakeLock;
  }, []);

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
    setLoop,
    pitchShift,
    setPitchShift,
    playbackSpeed,
    setPlaybackSpeed,
    gain,
    setGain,
    loopDelay,
    setLoopDelay,
    loopPauseStart,
    loopPauseEnd,
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

    };
    window.addEventListener("keypress", handleKey);
    return () => {
      window.removeEventListener("keypress", handleKey);
    };
  }, [loop, playState, setPlayState, setPosition]);

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
      Math.min(timeInMs, data.duration * 1000),
    );
    setTriggerUpdate(true);
    setPosition(timeInMs);
  };

  useEffect(() => {
    if (triggerUpdate) setTriggerUpdate(false);
  }, [triggerUpdate]);

  return (
    <>
      <div className="w-full max-w-200 h-full md:h-min p-4 md:p-6 bg-white flex flex-col justify-center gap-6 md:border md:border-neutral-2 md:rounded-xs md:shadow-md">
        <div className="[font-synthesis:none] flex items-center gap-4 justify-between self-stretch antialiased">
          <div className="flex items-start gap-4 min-w-0">
            {/* filename chip */}
            <div className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center self-stretch [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100 min-w-0">
              <span className="font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 truncate min-w-0">
                {filename}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" style={{ width: 21, height: "auto", overflow: "visible", flexShrink: 0 }}>
                <path d="M156,128a28,28,0,1,1-28-28A28,28,0,0,1,156,128ZM48,100a28,28,0,1,0,28,28A28,28,0,0,0,48,100Zm160,0a28,28,0,1,0,28,28A28,28,0,0,0,208,100Z" fill="#666666" />
              </svg>
            </div>
            {/* file info button */}
            <button className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center self-stretch w-40 shrink-0 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" style={{ width: 21, height: "auto", opacity: 0.54, overflow: "visible", flexShrink: 0 }}>
                <path d="M144,148a20,20,0,1,1-20-20A20,20,0,0,1,144,148Zm72-60V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-50.34,90.34-11.2-11.19a36.05,36.05,0,1,0-11.31,11.31l11.19,11.2a8,8,0,0,0,11.32-11.32ZM196,88,152,44V88Z" fill="#000000" />
              </svg>
              <span className="opacity-40 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 whitespace-nowrap">
                File Info
              </span>
            </button>
          </div>
          {/* home button */}
          <button
            onClick={() => navigate("/")}
            className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center w-43.5 h-11.25 shrink-0 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" style={{ width: 18, height: "auto", opacity: 0.5, overflow: "visible", flexShrink: 0 }}>
              <path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z" fill="#000000" />
            </svg>
            <span className="opacity-40 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 whitespace-nowrap">
              Home
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <PianoRoll />
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
        <div className="flex flex-col md:gap-12 gap-6 md:flex-row w-full h-min justify-center items-center md:px-8 md:py-4">
          <div
            className="w-full h-full flex flex-col items-center md:gap-4 gap-1 justify-center "
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
          <div className="flex flex-col items-center gap-2 text-sm text-neutral-400 shrink-0">
            <span>Loop pause</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={loopDelay}
                disabled={!loop}
                onChange={(e) =>
                  setLoopDelay(Math.max(0, Number(e.target.value)))
                }
                className="w-14 border border-neutral-2 rounded-xs px-1 py-0.5 text-center text-neutral-800 disabled:opacity-40"
              />
              <span>s</span>
            </div>
            <LoopPauseIndicator
              pauseStart={loopPauseStart}
              pauseEnd={loopPauseEnd}
            />
          </div>
          <div
            className="flex md:flex-col flex-row justify-between items-center gap-2 "
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
          </div>
        </div>
        <p className="fixed bottom-2 left-1/2 -translate-x-1/2 text-sm text-neutral-400">
          {wakeLockStatus}
        </p>
      </div>
      {showTutorial && (
        <Tutorial
          handleTutorialFinished={() => {
            setShowTutorial(false);
            localStorage.setItem("tutorial_shown", "true");
          }}
          steps={[
            {
              htmlSelector: "#playback-controls",
              contents: (
                <p>
                  Controls playback. Hover to see function and shortcut on
                  desktop browsers.
                </p>
              ),
            },
            {
              htmlSelector: "#recording-properties",
              contents: <p>Adjust pitch, speed, and volume.</p>,
            },
            {
              htmlSelector: "#reset-pitch",
              contents: <p>Click to reset to default</p>,
            },
            {
              htmlSelector: "#waveform-view",
              contents: (
                <p>
                  Click to select playback start point. Drag to select loop.
                  Scroll to zoom. Pan to move backwards/forwards
                </p>
              ),
            },
            {
              htmlSelector: "#waveform-controls",
              contents: (
                <p>
                  You can also use these controls to navigate around the
                  recording.
                </p>
              ),
            },
          ]}
        />
      )}
    </>
  );
};

const LoopPauseIndicator: FC<{
  pauseStart: RefObject<number | null>;
  pauseEnd: RefObject<number | null>;
}> = ({ pauseStart, pauseEnd }) => {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const SIZE = 16;
    const R = 6;
    const CX = SIZE / 2;
    const CY = SIZE / 2;

    let rafId: number;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const path = pathRef.current;
      if (!path) return;

      const start = pauseStart.current;
      const end = pauseEnd.current;

      if (start === null || end === null) {
        path.setAttribute("d", "");
        return;
      }

      const fraction = Math.min(1, Math.max(0, (performance.now() - start) / (end - start)));
      const angle = fraction * 2 * Math.PI;
      const ex = CX + R * Math.sin(angle);
      const ey = CY - R * Math.cos(angle);
      const largeArc = angle > Math.PI ? 1 : 0;
      path.setAttribute(
        "d",
        `M ${CX} ${CY} L ${CX} ${CY - R} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey} Z`,
      );
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [pauseEnd, pauseStart]);

  return (
    <svg viewBox="0 0 16 16" className="w-20 h-20 shrink-0">
      <circle cx="8" cy="8" r="6" className="fill-neutral-200" />
      <path ref={pathRef} className="fill-emerald-400" />
    </svg>
  );
};
