import { useContext, useEffect, useState } from "react";
import { Tutorial } from "./components/Tutorial";
import { PianoRoll } from "./components/PianoRoll";
import { PlaybackContext } from "./playback/PlaybackContext";
import { WaveformView } from "./components/WaveformView";
import { AudioStore } from "./AudioStore";
import { useFirstVisit } from "./lib/useFirstVisit";
import { PlaybackControls } from "./components/PlaybackControls";
import { AudioSettings } from "./components/AudioSettings";
import { TitleBar } from "./components/TitleBar";
import { loadSession, saveSession } from "./lib/useSessionPersistence";
import type { Section } from "./lib/waveform";

export const Loaded = ({ onMounted }: { onMounted?: () => void }) => {
  const { audio } = useContext(AudioStore);
  if (!audio) throw new Error("Loaded must be rendered within an audio route");
  const { buffer: data, filename } = audio;

  const { isFirstVisit: showTutorial, markVisited: markTutorialShown } =
    useFirstVisit();

  useEffect(() => {
    onMounted?.();
  }, [onMounted]);

  const [triggerUpdate, setTriggerUpdate] = useState<boolean>(false);

  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("Loaded must be used within a PlaybackProvider");
  }

  const {
    playbackPosition,
    triggerAction,
    playbackSettings,
    setAudioSettings,
  } = playback;
  const { loop } = playbackSettings;

  const session = loadSession();
  const [waveformRange] = useState<Section>(
    session?.filename === filename && session.waveformRange
      ? session.waveformRange
      : { start: 0, end: data.length },
  );

  useEffect(() => {
    if (session?.filename === filename && session.audioSettings) {
      setAudioSettings(session.audioSettings);
    }
  // only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveSession({ filename, audioSettings: playbackSettings });
  }, [filename, playbackSettings]);

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
      <div className="w-full max-w-240 h-full md:h-min p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
        <TitleBar />

        <div className="flex flex-col rounded-xl overflow-x-hidden overflow-y-clip self-stretch [box-shadow:var(--shadow-panel)] bg-white border border-border">
          <PianoRoll />
          <div className="border-t border-border max-md:grow">
            <WaveformView
              initialData={{
                data: data,
                range: { start: 0, end: data.length },
                section: loop,
              }}
              initialRange={waveformRange}
              positionReference={playbackPosition}
              animate={true}
              handlePosition={handlePosition}
              handleSelection={(section) => {
                setAudioSettings({ loop: section });
              }}
              onRangeChange={(range) => saveSession({ waveformRange: range })}
            />
          </div>
        </div>

        <div className="[font-synthesis:none] md:grid md:grid-cols-2 max-md:flex max-md:flex-col-reverse max-md:flex-1 antialiased gap-4">
          <PlaybackControls />
          <AudioSettings />
        </div>
      </div>

      {showTutorial && (
        <Tutorial
          handleTutorialFinished={markTutorialShown}
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
