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
import { Menu } from "@base-ui/react/menu";
import { Dialog } from "@base-ui/react/dialog";
import { Tutorial } from "./components/Tutorial";
import { PianoRoll } from "./components/PianoRoll";
import { PlaybackContext } from "./playback/PlaybackContext";
import { WaveformView } from "./components/WaveformView";
import { AudioStore } from "./AudioStore";
import { RecordingsStore } from "./RecordingsStore";
import { useDecodeFile } from "./lib/useDecodeFile";
import { formatSeconds } from "./lib/util";

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FileInfoRow: FC<{ label: string; value: string; mono: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className="opacity-50 font-['Inria_Sans',system-ui,sans-serif] text-black text-sm shrink-0">
      {label}
    </span>
    <span
      className={`text-black text-sm text-right min-w-0 break-all ${mono ? "font-['Space_Mono',monospace]" : "font-['Inria_Sans',system-ui,sans-serif]"}`}
    >
      {value}
    </span>
  </div>
);

export const Loaded = () => {
  const { audio } = useContext(AudioStore);
  if (!audio) throw new Error("Loaded must be rendered within an audio route");
  const { buffer: data, filename, fileSize } = audio;
  const navigate = useNavigate();
  const decodeFile = useDecodeFile();
  const { cachedFiles, fileMeta, reload } = useContext(RecordingsStore);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [showTutorial, setShowTutorial] = useState(
    localStorage.getItem("tutorial_shown") !== "true",
  );

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
      if (wakeLockRef.current !== null) wakeLockRef.current.release();
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
    setGain,
    setLoopDelay,
    loopPauseStart,
    loopPauseEnd,
  } = playback;

  const [renderedGain, setRenderedGain] = useState<number>(1);
  useEffect(() => {
    setGain(renderedGain * renderedGain);
  }, [renderedGain, setGain]);

  // delayRatio: fraction of the cycle that is recording (0.05–0.95).
  // loopDelay seconds = loopDuration * (1 - ratio) / ratio
  const [delayRatio, setDelayRatio] = useState<number>(0.5);
  useEffect(() => {
    if (!loop) {
      setLoopDelay(0);
      return;
    }
    const loopDurationS = (loop.end - loop.start) / data.sampleRate;
    setLoopDelay((loopDurationS * (1 - delayRatio)) / delayRatio);
  }, [loop, delayRatio, data.sampleRate, setLoopDelay]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "0") {
        const currentStart = loop ? loop.start : 0;
        setPosition(currentStart);
        setPlayState("playing");
      } else if (e.key === "p") {
        if (playState === "paused" || playState === "frozen") {
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
    return () => window.removeEventListener("keypress", handleKey);
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
      if (e.key === "h") rewindFiveSeconds();
      else if (e.key === "l") fastForwardFiveSeconds();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      <div className="w-full max-w-240 h-full md:h-min p-4 md:p-6 flex flex-col justify-center gap-8.5">
        {/* Header */}
        <div className="[font-synthesis:none] flex items-center gap-4 justify-between self-stretch antialiased">
          <div className="flex items-start gap-4 min-w-0">
            {/* Song title — opens recent-songs menu */}
            <Menu.Root>
              <Menu.Trigger className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center self-stretch [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100 cursor-pointer min-w-0">
                <span className="font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 truncate min-w-0">
                  {filename}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 256 256" style={{ flexShrink: 0 }}>
                  <path d="M156,128a28,28,0,1,1-28-28A28,28,0,0,1,156,128ZM48,100a28,28,0,1,0,28,28A28,28,0,0,0,48,100Zm160,0a28,28,0,1,0,28,28A28,28,0,0,0,208,100Z" fill="#666666" />
                </svg>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="start" sideOffset={8}>
                  <Menu.Popup className="z-50 w-80 rounded-xl bg-white border border-[#0000001A] [box-shadow:#0000001A_0px_4px_16px] overflow-hidden flex flex-col outline-none">
                    {/* Sticky: upload option */}
                    <Menu.Item
                      className="shrink-0 flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100 border-b border-[#0000001A]"
                      closeOnClick={false}
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style={{ opacity: 0.5, flexShrink: 0 }}>
                        <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                      </svg>
                      <span className="font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5">
                        Upload a Recording
                      </span>
                    </Menu.Item>
                    {/* Scrollable recordings list */}
                    <div className="overflow-y-auto max-h-72 flex flex-col">
                      {cachedFiles.length === 0 ? (
                        <div className="px-4 py-4 opacity-40 font-['Inria_Sans',system-ui,sans-serif] text-black text-sm text-center">
                          No recordings yet
                        </div>
                      ) : (
                        cachedFiles.map((file) => (
                          <Menu.Item
                            key={file.name}
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100"
                            onClick={() => decodeFile(file)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style={{ opacity: 0.4, flexShrink: 0 }}>
                              <path d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z" />
                            </svg>
                            <span className={`flex-1 min-w-0 font-['Inria_Sans',system-ui,sans-serif] text-base/5 truncate ${file.name === filename ? "font-bold text-black" : "text-black"}`}>
                              {file.name}
                            </span>
                            {file.name === filename && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" style={{ flexShrink: 0 }}>
                                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" fill="#1CCA93" />
                              </svg>
                            )}
                          </Menu.Item>
                        ))
                      )}
                    </div>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>

            {/* File info dialog */}
            <Dialog.Root>
              <Dialog.Trigger className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center self-stretch w-40 shrink-0 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 256 256" style={{ opacity: 0.54, flexShrink: 0 }}>
                  <path d="M144,148a20,20,0,1,1-20-20A20,20,0,0,1,144,148Zm72-60V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-50.34,90.34-11.2-11.19a36.05,36.05,0,1,0-11.31,11.31l11.19,11.2a8,8,0,0,0,11.32-11.32ZM196,88,152,44V88Z" fill="#000000" />
                </svg>
                <span className="opacity-40 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 whitespace-nowrap">
                  File Info
                </span>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
                <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-[#0000001A] [box-shadow:#0000001A_0px_4px_24px] p-6 flex flex-col gap-5 outline-none">
                  <div className="flex items-start justify-between gap-4">
                    <Dialog.Title className="font-['Inria_Sans',system-ui,sans-serif] font-bold text-black text-lg/6">
                      File Info
                    </Dialog.Title>
                    <Dialog.Close className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-neutral-100 active:bg-neutral-200 cursor-pointer outline-none -mt-0.5 -mr-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                        <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" fill="#666" />
                      </svg>
                    </Dialog.Close>
                  </div>
                  <div className="flex flex-col gap-3">
                    <FileInfoRow label="Name" value={filename} mono={false} />
                    <FileInfoRow label="Size" value={formatSize(fileSize)} mono />
                    <FileInfoRow label="Duration" value={formatSeconds(data.duration)} mono />
                    <FileInfoRow label="Sample rate" value={`${data.sampleRate.toLocaleString()} Hz`} mono />
                    <FileInfoRow label="Channels" value={String(data.numberOfChannels)} mono />
                    {fileMeta.get(filename)?.uploadedAt != null && (
                      <FileInfoRow
                        label="Added"
                        value={new Date(fileMeta.get(filename)!.uploadedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        mono={false}
                      />
                    )}
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>

            {/* Hidden upload input used by the menu */}
            <input
              ref={uploadInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                await decodeFile(file);
                await reload();
              }}
            />
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex overflow-clip rounded-lg items-center gap-3 px-3.25 py-3.25 justify-center w-43.5 h-11.25 shrink-0 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] hover:bg-white active:bg-neutral-100 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 256 256"
              style={{
                width: 18,
                height: "auto",
                opacity: 0.5,
                overflow: "visible",
                flexShrink: 0,
              }}
            >
              <path
                d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"
                fill="#000000"
              />
            </svg>
            <span className="opacity-40 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5 whitespace-nowrap">
              Home
            </span>
          </button>
        </div>

        {/* Waveform card */}
        <div className="flex flex-col rounded-xl overflow-hidden self-stretch [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A]">
          <PianoRoll />
          <div className="border-t border-[#0000001A]">
            <WaveformView
              initialData={{
                data: data,
                range: { start: 0, end: data.length },
                section: loop,
              }}
              positionReference={playbackPosition}
              animate={playState === "playing" || triggerUpdate}
              handlePosition={handlePosition}
              handleSelection={(section) => setLoop(section)}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="[font-synthesis:none] flex items-stretch gap-7 self-stretch antialiased">
          {/* Section 4: Play controls */}
          <div className="flex overflow-clip items-start gap-4 flex-col p-4 rounded-xl flex-1 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-solid border-[#0000001A]">
            <div className="flex items-start gap-4 flex-1 self-stretch">
              {/* Play / Pause */}
              <button
                onClick={() =>
                  playState === "playing"
                    ? setPlayState("paused")
                    : setPlayState("playing")
                }
                className={`flex overflow-clip rounded-md items-center p-3.25 flex-1 justify-center self-stretch border border-[#0000000D] cursor-pointer ${playState === "playing" ? "bg-[#1CCA93] hover:bg-[#3DD4A3] active:bg-[#17A87A] [box-shadow:#FFFFFF40_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px]" : "bg-[#FDFDFD] hover:bg-white active:bg-[#F0F0F0] [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px]"}`}
              >
                {playState === "playing" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 256 256"
                    style={{
                      width: 24,
                      height: "auto",
                      overflow: "visible",
                      flexShrink: 0,
                    }}
                  >
                    <path
                      d="M216,48H168a16,16,0,0,0-16,16V192a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM88,48H40A16,16,0,0,0,24,64V192a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V64A16,16,0,0,0,88,48Z"
                      fill="#FFFFFF"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 256 256"
                    style={{
                      width: 24,
                      height: "auto",
                      overflow: "visible",
                      flexShrink: 0,
                    }}
                  >
                    <path
                      d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"
                      fill="#1CCA93"
                    />
                  </svg>
                )}
              </button>
              {/* Freeze */}
              <button
                onClick={() =>
                  playState === "frozen"
                    ? setPlayState("paused")
                    : setPlayState("frozen")
                }
                className={`flex overflow-clip rounded-md items-center p-3.25 flex-1 justify-center self-stretch border border-[#0000000D] cursor-pointer ${playState === "frozen" ? "bg-[#0099DC] hover:bg-[#33ADDE] active:bg-[#007AB0] [box-shadow:#FFFFFF40_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px]" : "bg-[#FDFDFD] hover:bg-white active:bg-[#F0F0F0] [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px]"}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 256 256"
                  style={{ overflow: "visible", flexShrink: 0 }}
                >
                  <path
                    d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm42.37,119.22,18.94-6.76a8,8,0,1,1,5.38,15.08l-15.48,5.52,4.52,16.87a8,8,0,0,1-5.66,9.8A8.23,8.23,0,0,1,176,184a8,8,0,0,1-7.73-5.93l-5.57-20.8L136,141.86v30.83l13.66,13.65a8,8,0,0,1-11.32,11.32L128,187.31l-10.34,10.35a8,8,0,0,1-11.32-11.32L120,172.69V141.86L93.3,157.27l-5.57,20.8A8,8,0,0,1,80,184a8.23,8.23,0,0,1-2.07-.27,8,8,0,0,1-5.66-9.8l4.52-16.87-15.48-5.52a8,8,0,0,1,5.38-15.08l18.94,6.76L112,128,85.63,112.78l-18.94,6.76A8.18,8.18,0,0,1,64,120a8,8,0,0,1-2.69-15.54l15.48-5.52L72.27,82.07a8,8,0,0,1,15.46-4.14l5.57,20.8L120,114.14V83.31L106.34,69.66a8,8,0,0,1,11.32-11.32L128,68.69l10.34-10.35a8,8,0,0,1,11.32,11.32L136,83.31v30.83l26.7-15.41,5.57-20.8a8,8,0,0,1,15.46,4.14l-4.52,16.87,15.48,5.52A8,8,0,0,1,192,120a8.18,8.18,0,0,1-2.69-.46l-18.94-6.76L144,128Z"
                    fill={playState === "frozen" ? "#FFFFFF" : "#0099DC"}
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-start gap-4 flex-1 self-stretch">
              {/* Rewind 5s */}
              <button
                onClick={rewindFiveSeconds}
                className="flex overflow-clip rounded-md items-center p-3.25 flex-1 justify-center self-stretch [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000000D] cursor-pointer hover:bg-white active:bg-[#F0F0F0]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 256 256"
                  style={{
                    width: 24,
                    height: "auto",
                    opacity: 0.67,
                    overflow: "visible",
                    flexShrink: 0,
                  }}
                >
                  <path
                    d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"
                    fill="#000000"
                  />
                </svg>
              </button>
              {/* Fast-forward 5s */}
              <button
                onClick={fastForwardFiveSeconds}
                className="flex overflow-clip rounded-md items-center p-3.25 flex-1 justify-center self-stretch [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000000D] cursor-pointer hover:bg-white active:bg-[#F0F0F0]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 256 256"
                  style={{
                    width: 24,
                    height: "auto",
                    opacity: 0.67,
                    overflow: "visible",
                    flexShrink: 0,
                    rotate: "180deg",
                    transformOrigin: "50% 50%",
                  }}
                >
                  <path
                    d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"
                    fill="#000000"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Section 5: Settings */}
          <div className="flex flex-col items-end gap-3.25 flex-1">
            <LoopDelaySlider
              ratio={delayRatio}
              onChange={setDelayRatio}
              pauseStart={loopPauseStart}
              pauseEnd={loopPauseEnd}
            />
            <div className="flex flex-col justify-center self-stretch rounded-xl py-5 px-4 gap-4 shrink-0 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A]">
              <AudioSlider
                label="Pitch"
                value={pitchShift}
                min={-10}
                max={10}
                step={0.2}
                onChange={(v) => setPitchShift(Math.round(v * 10) / 10)}
                formatValue={(v) =>
                  `${v >= 0 ? "+" : ""}${Math.round(v * 10) / 10}`
                }
                unit="smt"
              />
              <AudioSlider
                label="Speed"
                value={playbackSpeed}
                min={0.1}
                max={1.9}
                step={0.1}
                onChange={(v) => setPlaybackSpeed(Math.round(v * 10) / 10)}
                formatValue={(v) => `${Math.round(v * 100)}`}
                unit="%"
              />
              <AudioSlider
                label="Volume"
                value={renderedGain}
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => setRenderedGain(Math.round(v * 10) / 10)}
                formatValue={(v) => `${Math.round(v * 100)}`}
                unit="%"
              />
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
              htmlSelector: "#waveform-view",
              contents: (
                <p>
                  Click to set playback position. Drag to select a loop region.
                  Scroll to zoom. Pan strip to move around.
                </p>
              ),
            },
            {
              htmlSelector: "#waveform-controls",
              contents: (
                <p>
                  Use these controls to zoom and scroll around the recording.
                </p>
              ),
            },
          ]}
        />
      )}
    </>
  );
};

// ─── Loop Delay Slider ────────────────────────────────────────────────────────

const LoopDelaySlider: FC<{
  ratio: number;
  onChange: (ratio: number) => void;
  pauseStart: RefObject<number | null>;
  pauseEnd: RefObject<number | null>;
}> = ({ ratio, onChange, pauseStart, pauseEnd }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Animate the green progress fill during the delay pause
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const el = progressRef.current;
      if (!el) return;
      const start = pauseStart.current;
      const end = pauseEnd.current;
      if (start === null || end === null) {
        el.style.width = "0%";
        return;
      }
      const fraction = Math.min(
        1,
        Math.max(0, (performance.now() - start) / (end - start)),
      );
      el.style.width = `${fraction * 100}%`;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [pauseStart, pauseEnd]);

  const updateRatio = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(
      0.05,
      Math.min(0.95, (clientX - rect.left) / rect.width),
    );
    onChange(pct);
  };

  return (
    <div className="flex items-center h-9.5 px-3 self-stretch rounded-xl gap-3 shrink-0 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A]">
      <span className="shrink-0 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5">
        Loop Delay
      </span>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative flex-1 h-1.5 cursor-pointer"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateRatio(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) updateRatio(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {/* Fill area — overflow-hidden clips both fills */}
        <div className="absolute inset-0 rounded-[3px] overflow-hidden bg-[#F5F5F5] border border-[#0000000D]">
          {/* Recording portion (gray) */}
          <div
            className="absolute inset-y-0 left-0 bg-[#ADADAD]"
            style={{ width: `${ratio * 100}%` }}
          />
          {/* Delay portion: green progress grows from handle rightward */}
          <div
            className="absolute inset-y-0 overflow-hidden"
            style={{ left: `${ratio * 100}%`, right: 0 }}
          >
            <div
              ref={progressRef}
              className="absolute inset-y-0 left-0 bg-emerald-400"
              style={{ width: "0%" }}
            />
          </div>
        </div>
        {/* Draggable handle */}
        <div
          className="absolute top-1/2 z-10 w-6 h-5.5 rounded-[5px] -translate-x-1/2 -translate-y-1/2 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] pointer-events-none"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
};

// ─── Audio Slider (Pitch / Speed / Volume) ────────────────────────────────────

const AudioSlider: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  unit: string;
}> = ({ label, value, min, max, step, onChange, formatValue, unit }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setValue = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  };

  const thumbPct = (value - min) / (max - min);

  return (
    <div className="flex items-center gap-2 self-stretch">
      <div className="w-15 shrink-0 font-['Inria_Sans',system-ui,sans-serif] text-black text-base/5">
        {label}
      </div>
      <div
        ref={trackRef}
        className="relative flex-1 h-5 rounded-[3px] bg-[#F5F5F5] border border-[#0000000D] cursor-pointer"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setValue(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setValue(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-6.5 rounded-xs [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A]"
          style={{ left: `calc(${thumbPct * 100}% - 5px)` }}
        />
      </div>
      <div className="flex items-center gap-3 w-17.5 shrink-0">
        <div className="flex items-center px-1 py-0.5 rounded-sm bg-[#E8E8E8]">
          <span className="font-['Space_Mono',system-ui,sans-serif] text-black text-base/5 tabular-nums">
            {formatValue(value)}
          </span>
        </div>
        <span className="font-['Space_Mono',system-ui,sans-serif] text-black text-base/5">
          {unit}
        </span>
      </div>
    </div>
  );
};
