import { useContext, useEffect, useRef, useState, type FC } from "react";
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
import { formatSeconds, formatSize } from "./lib/util";
import { PlaybackControls } from "./components/PlaybackControls";
import { AudioSettings } from "./components/AudioSettings";

const FileInfoRow: FC<{ label: string; value: string; mono: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className="opacity-50 font-inria text-black text-sm shrink-0">
      {label}
    </span>
    <span
      className={`text-black text-sm text-right min-w-0 break-all ${mono ? "font-space-mono" : "font-inria"}`}
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
  const { cachedFiles, fileMeta, cacheFile } = useContext(RecordingsStore);
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
    triggerAction,
    playbackSettings,
    setAudioSettings,
  } = playback;
  const { loop } = playbackSettings;

  const handlePosition = (sampleIndex: number) => {
    const timeInSeconds = sampleIndex / data.sampleRate;
    const timeInMs = timeInSeconds * 1000;
    setTriggerUpdate(true);
    triggerAction({ type: "move", position: timeInMs });
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
              <Menu.Trigger className="btn-surface rounded-lg gap-3 px-3.25 py-3.25 self-stretch cursor-pointer min-w-0">
                <span className="font-inria text-black text-base/5 truncate min-w-0">
                  {filename}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="21"
                  height="21"
                  viewBox="0 0 256 256"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M156,128a28,28,0,1,1-28-28A28,28,0,0,1,156,128ZM48,100a28,28,0,1,0,28,28A28,28,0,0,0,48,100Zm160,0a28,28,0,1,0,28,28A28,28,0,0,0,208,100Z"
                    fill="#666666"
                  />
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 256 256"
                        style={{ opacity: 0.5, flexShrink: 0 }}
                      >
                        <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                      </svg>
                      <span className="font-inria text-black text-base/5">
                        Upload a Recording
                      </span>
                    </Menu.Item>
                    {/* Scrollable recordings list */}
                    <div className="overflow-y-auto max-h-72 flex flex-col">
                      {cachedFiles.length === 0 ? (
                        <div className="px-4 py-4 opacity-40 font-inria text-black text-sm text-center">
                          No recordings yet
                        </div>
                      ) : (
                        cachedFiles.map((file) => (
                          <Menu.Item
                            key={file.name}
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100"
                            onClick={async () => await decodeFile(file)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 256 256"
                              style={{ opacity: 0.4, flexShrink: 0 }}
                            >
                              <path d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z" />
                            </svg>
                            <span
                              className={`flex-1 min-w-0 font-inria text-base/5 truncate ${file.name === filename ? "font-bold text-black" : "text-black"}`}
                            >
                              {file.name}
                            </span>
                            {file.name === filename && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 256 256"
                                style={{ flexShrink: 0 }}
                              >
                                <path
                                  d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
                                  fill="#1CCA93"
                                />
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
              <Dialog.Trigger className="btn-surface rounded-lg gap-3 px-3.25 py-3.25 self-stretch w-40 shrink-0 cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="21"
                  height="21"
                  viewBox="0 0 256 256"
                  style={{ opacity: 0.54, flexShrink: 0 }}
                >
                  <path
                    d="M144,148a20,20,0,1,1-20-20A20,20,0,0,1,144,148Zm72-60V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-50.34,90.34-11.2-11.19a36.05,36.05,0,1,0-11.31,11.31l11.19,11.2a8,8,0,0,0,11.32-11.32ZM196,88,152,44V88Z"
                    fill="#000000"
                  />
                </svg>
                <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap">
                  File Info
                </span>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
                <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-[#0000001A] [box-shadow:#0000001A_0px_4px_24px] p-6 flex flex-col gap-5 outline-none">
                  <div className="flex items-start justify-between gap-4">
                    <Dialog.Title className="font-inria font-bold text-black text-lg/6">
                      File Info
                    </Dialog.Title>
                    <Dialog.Close className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-neutral-100 active:bg-neutral-200 cursor-pointer outline-none -mt-0.5 -mr-0.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 256 256"
                      >
                        <path
                          d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
                          fill="#666"
                        />
                      </svg>
                    </Dialog.Close>
                  </div>
                  <div className="flex flex-col gap-3">
                    <FileInfoRow label="Name" value={filename} mono={false} />
                    <FileInfoRow
                      label="Size"
                      value={formatSize(fileSize)}
                      mono
                    />
                    <FileInfoRow
                      label="Duration"
                      value={formatSeconds(data.duration)}
                      mono
                    />
                    <FileInfoRow
                      label="Sample rate"
                      value={`${data.sampleRate.toLocaleString()} Hz`}
                      mono
                    />
                    <FileInfoRow
                      label="Channels"
                      value={String(data.numberOfChannels)}
                      mono
                    />
                    {fileMeta.get(filename)?.uploadedAt != null && (
                      <FileInfoRow
                        label="Added"
                        value={new Date(
                          fileMeta.get(filename)!.uploadedAt,
                        ).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
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
                await cacheFile(file);
              }}
            />
          </div>
          <button
            onClick={() => {
              navigate("/");
            }}
            className="btn-surface rounded-lg gap-3 px-3.25 py-3.25 w-43.5 h-11.25 shrink-0 cursor-pointer"
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
            <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap">
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
              handleSelection={(section) => setAudioSettings({ loop: section })}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="[font-synthesis:none] flex items-stretch gap-7 self-stretch antialiased max-md:flex-col-reverse">
          <PlaybackControls />
          <AudioSettings />
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
