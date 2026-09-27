import { useCallback, useContext, useEffect, useMemo } from "react";
import { useDebounce } from "./lib/useDebounce";
import { Tutorial, type TutorialStep } from "./components/Tutorial";
import { PianoRoll } from "./components/PianoRoll";
import { PlaybackContext } from "./playback/PlaybackContext";
import { AudioStore } from "./AudioStore";
import { PlaybackControls } from "./components/PlaybackControls";
import { PlaybackSliders } from "./components/PlaybackSettings";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { loadSession, saveSession } from "./lib/useSessionPersistence";
import type { Section } from "./lib/waveform";
import { capture } from "./lib/posthog";
import { Waveform } from "./components/Waveform";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    htmlSelector: "#timeline-ruler",
    contents: <p>Click to set playback position</p>,
  },
  {
    htmlSelector: "#waveform-canvas",
    contents: <p>Pinch to zoom in/out</p>,
  },
  {
    htmlSelector: "#waveform-canvas",
    contents: <p>Drag to pan</p>,
  },
  {
    htmlSelector: "#timeline-loop",
    contents: <p>The loop stays put — drag the handles or pan the recording under it</p>,
  },
  {
    htmlSelector: "#piano",
    contents: <p>Click on piano to play note</p>,
  },
];

export const Editor = () => {
  const { audio } = useContext(AudioStore);
  if (!audio) throw new Error("Editor must be rendered within an audio route");
  const { buffer: data, filename } = audio;

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

  const handlePosition = useCallback(
    (sampleIndex: number) =>
      triggerAction({
        type: "move",
        position: (sampleIndex / data.sampleRate) * 1000,
      }),
    [data.sampleRate, triggerAction],
  );

  const handleRangeChange = useDebounce(
    useCallback((viewport: Section) => saveSession({ viewport }), []),
    250,
  );

  const handleLoopChange = useCallback(
    (loop: Section | undefined) => {
      setAudioSettings({ loop });
      if (loop) capture("loop_region_set");
    },
    [setAudioSettings],
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
      <AlwaysAwakeIndicator />
      <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
        <TitleBar />

        <div className="flex flex-col gap-4 self-stretch h-full min-h-0">
          <div className="flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border shrink-0">
            <PianoRoll />
          </div>
          <div className="relative flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border flex-1 min-h-0 md:min-h-72 max-md:grow">
            <Waveform
              waveformData={data}
              onPosition={handlePosition}
              onRangeChange={handleRangeChange}
              onLoopChange={handleLoopChange}
              initialViewport={initialViewport}
              initialSelection={initialSelection}
              positionMS={playbackPosition}
            />
          </div>
        </div>

        <PlaybackControls settings={<PlaybackSliders />} />
      </div>

      <Tutorial steps={TUTORIAL_STEPS} />
    </>
  );
};
