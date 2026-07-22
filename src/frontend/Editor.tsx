import { useCallback, useContext, useEffect, useMemo } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { useDebounce } from "./lib/useDebounce";
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

  const {
    isFirstVisit: showTutorial,
    markVisited: markTutorialShown,
    resetVisit: retriggerTutorial,
  } = useFirstVisit();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border flex-1 min-h-0 md:min-h-72 max-md:grow">
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

            <PlaybackSettings />
          </div>
        </div>

        <PlaybackControls />
      </div>

      {!showTutorial && (
        <button
          onClick={retriggerTutorial}
          aria-label="Restart tutorial"
          className="fixed top-3 left-4 z-50 cursor-pointer bg-transparent border-0 p-0"
        >
          <InfoIcon size={20} color="#a3a3a3" weight="fill" />
        </button>
      )}

      {showTutorial && (
        <Tutorial
          handleTutorialFinished={() => {
            capture("tutorial_completed");
            markTutorialShown();
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
