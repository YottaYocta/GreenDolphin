import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { useDebounce } from "./lib/useDebounce";
import { Dialog } from "@base-ui/react/dialog";
import { Tutorial } from "./components/Tutorial";
import { PianoRoll } from "./components/PianoRoll";
import { PlaybackContext } from "./playback/PlaybackContext";
import { AudioStore } from "./AudioStore";
import { useFirstVisit } from "./lib/useFirstVisit";
import { PlaybackControls } from "./components/PlaybackControls";
import { PlaybackSettings } from "./components/PlaybackSettings";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { loadSession, saveSession } from "./lib/useSessionPersistence";
import type { Section } from "./lib/waveform";
import { capture } from "./lib/posthog";
import { Waveform } from "./components/Waveform";
import { useAlwaysAwake } from "./lib/useAlwaysAwake";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";

export const Editor = () => {
  const { audio } = useContext(AudioStore);
  if (!audio) throw new Error("Editor must be rendered within an audio route");
  const { buffer: data, filename } = audio;

  const { isFirstVisit: showTutorial, markVisited: markTutorialShown } =
    useFirstVisit();
  const [walkthroughActive, setWalkthroughActive] = useState(false);

  const { activate, method, wakeLockError, videoError } = useAlwaysAwake();

  useEffect(() => {
    activate();
  }, [activate]);

  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("Editor must be used within a PlaybackProvider");
  }

  const {
    playbackPosition,
    triggerAction,
    playbackSettings,
    setAudioSettings,
  } = playback;

  useEffect(() => {
    saveSession({ filename, audioSettings: playbackSettings });
  }, [filename, playbackSettings]);

  const handlePosition = (sampleIndex: number) => {
    const timeInSeconds = sampleIndex / data.sampleRate;
    const timeInMs = timeInSeconds * 1000;
    triggerAction({ type: "move", position: timeInMs });
  };

  const handleRangeChange = useDebounce(
    useCallback((viewport: Section) => saveSession({ viewport }), []),
    250,
  );

  const { initialViewport, initialSelection } = useMemo(() => {
    const persistedSession = loadSession();
    const sessionMatches = persistedSession?.filename === filename;
    return {
      initialViewport: sessionMatches ? persistedSession?.viewport : undefined,
      initialSelection: sessionMatches
        ? persistedSession?.audioSettings?.loop
        : undefined,
    };
  }, [filename]);

  return (
    <>
      <AlwaysAwakeIndicator
        method={method}
        wakeLockError={wakeLockError}
        videoError={videoError}
        onRetry={activate}
      />
      <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
        <TitleBar />

        <div className="flex flex-col gap-4 self-stretch h-full min-h-0">
          <div className="flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border shrink-0">
            <PianoRoll />
          </div>
          <div className="relative flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border flex-1 min-h-0 md:min-h-72 max-md:grow">
            <PlaybackSettings>
              <Waveform
                waveformData={data}
                handlePosition={handlePosition}
                handleRangeChange={handleRangeChange}
                handleSelection={(selection) => {
                  setAudioSettings({ loop: selection });
                  capture("loop_region_set");
                }}
                initialViewport={initialViewport}
                initialSelection={initialSelection}
                positionMS={playbackPosition}
              ></Waveform>
            </PlaybackSettings>
          </div>
        </div>

        <PlaybackControls />
      </div>

      {!showTutorial && !walkthroughActive && (
        <button
          onClick={() => setWalkthroughActive(true)}
          aria-label="Restart tutorial"
          className="fixed top-3 left-4 z-50 cursor-pointer bg-transparent border-0 p-0"
        >
          <InfoIcon size={20} color="#a3a3a3" weight="fill" />
        </button>
      )}

      <Dialog.Root
        open={showTutorial && !walkthroughActive}
        onOpenChange={(open) => {
          if (!open) markTutorialShown();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
          <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col gap-6 p-6 outline-none">
            <Dialog.Title className="font-inria text-black/60 text-center">
              Welcome to GreenDolphin!
              <br />
              Would you like to see a walkthrough of the features?
            </Dialog.Title>
            <div className="flex justify-center gap-4">
              <button
                onClick={markTutorialShown}
                className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm"
              >
                <span className="opacity-40">Maybe later</span>
              </button>
              <button
                onClick={() => setWalkthroughActive(true)}
                className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white"
              >
                Yes
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {walkthroughActive && (
        <Tutorial
          handleTutorialFinished={() => {
            capture("tutorial_completed");
            markTutorialShown();
            setWalkthroughActive(false);
          }}
          steps={[
            {
              htmlSelector: "#waveform-canvas",
              contents: <p>Click to set playback position</p>,
            },
            {
              htmlSelector: "#waveform-canvas",
              contents: <p>Drag to pan</p>,
            },
            {
              htmlSelector: "#waveform-canvas",
              contents: <p>Pinch to zoom in/out</p>,
            },
            {
              htmlSelector: "#trackbar",
              contents: <p>Drag endpoints to set loop</p>,
            },
            {
              htmlSelector: "#piano",
              contents: <p>Click on piano to play note</p>,
            },
          ]}
        />
      )}
    </>
  );
};
