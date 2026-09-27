import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import { Timeline } from "../components/Timeline";
import {
  FULL_LOOP,
  sectionToLoop,
  type TimelineState,
} from "../components/Timeline/types";
import { AudioStore } from "../AudioStore";
import { PlaybackContext } from "../playback/PlaybackContext";
import { TitleBar } from "../components/TitleBar/TitleBar";
import { Tutorial, type TutorialStep } from "../components/Tutorial";
import { loadSession, saveSession } from "../lib/useSessionPersistence";
import { loadLoopPrefs } from "../lib/loopPrefs";
import { AlwaysAwakeIndicator } from "../components/AlwaysAwakeIndicator";
import { clampSection } from "../lib/util";
import { capture } from "../lib/posthog";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { describeYouTubeError } from "./iframeApi";
import {
  YouTubePlaybackProvider,
  YOUTUBE_SAMPLE_RATE,
} from "./YouTubePlaybackProvider";
import { PlaybackControls } from "../components/PlaybackControls";
import { YouTubeSettings } from "./YouTubeSettings";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    htmlSelector: "#timeline-ruler",
    contents: <p>Click to set playback position</p>,
  },
  {
    htmlSelector: "#timeline-loop",
    contents: <p>The loop stays put — drag the handles or pan the video under it</p>,
  },
];

export const YouTubeEditor = () => {
  const { video } = useContext(AudioStore);
  if (!video)
    throw new Error("YouTubeEditor must be rendered within a video route");

  const { containerRef, player, duration, errorCode, subscribe } =
    useYouTubePlayer(video.videoId);

  const initialSettings = useMemo(() => {
    const session = loadSession();
    const sessionSettings =
      session?.filename === video.filename ? session.audioSettings : undefined;
    return {
      ...sessionSettings,
      loopOptions: loadLoopPrefs().loopOptions ?? sessionSettings?.loopOptions,
    };
  }, [video.filename]);

  return (
    <YouTubePlaybackProvider
      player={player}
      duration={duration}
      subscribe={subscribe}
      initialSettings={initialSettings}
    >
      <YouTubeEditorView
        containerRef={containerRef}
        duration={duration}
        errorCode={errorCode}
        filename={video.filename}
        initialSelection={initialSettings?.loop}
      />
    </YouTubePlaybackProvider>
  );
};

function YouTubeEditorView({
  containerRef,
  duration,
  errorCode,
  filename,
  initialSelection,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  duration: number;
  errorCode: number | null;
  filename: string;
  initialSelection?: Section;
}) {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("YouTubeEditorView must be used within a PlaybackProvider");
  const {
    playbackPosition,
    triggerAction,
    playbackSettings,
    setAudioSettings,
  } = playback;

  useEffect(() => {
    saveSession({ filename, audioSettings: playbackSettings });
  }, [filename, playbackSettings]);

  const totalMS = duration * 1000;
  const stateRef = useRef<TimelineState>({
    viewport: { start: 0, end: totalMS },
    loop: FULL_LOOP,
  });

  useEffect(() => {
    if (totalMS <= 0) return;
    const full = { start: 0, end: totalMS };
    stateRef.current = {
      viewport: full,
      loop:
        initialSelection && initialSelection.end > initialSelection.start
          ? sectionToLoop(full, clampSection(initialSelection, full))
          : FULL_LOOP,
    };
  }, [totalMS, initialSelection]);

  const handleRange = useCallback((viewport: Section) => {
    stateRef.current = { ...stateRef.current, viewport };
  }, []);
  const handlePosition = useCallback(
    (positionMS: number) => triggerAction({ type: "move", position: positionMS }),
    [triggerAction],
  );
  const handleLoopEditStart = useCallback(
    () => setAudioSettings({ loop: undefined }),
    [setAudioSettings],
  );
  const handleLoopCommit = useCallback(
    (selection: Section) => {
      setAudioSettings({ loop: selection });
      capture("loop_region_set", { source: "youtube" });
    },
    [setAudioSettings],
  );

  const ready = duration > 0;

  return (
    <>
      <AlwaysAwakeIndicator />
      <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
        <TitleBar />

        <div className="relative flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border flex-1 min-h-0 md:min-h-72 max-md:grow">
          <YouTubeSettings>
          <div className="w-full flex items-center justify-center p-4 pt-14 md:pt-6 flex-1 min-h-0">
            <div className="relative aspect-video w-full h-full max-w-150 max-h-full bg-black rounded-lg overflow-hidden">
              <div
                ref={containerRef}
                className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full"
              />
            </div>
          </div>
          <div className="px-4 pb-4 shrink-0">
            {errorCode !== null ? (
              <div className="w-full h-8 pt-1 flex items-center justify-center text-sm text-red-600/80 font-inria">
                {describeYouTubeError(errorCode)}
              </div>
            ) : ready ? (
              <div className="h-24">
                <Timeline
                  stateRef={stateRef}
                  totalSamples={totalMS}
                  sampleRate={YOUTUBE_SAMPLE_RATE}
                  positionMS={playbackPosition}
                  onRangeChange={handleRange}
                  onPosition={handlePosition}
                  onLoopEditStart={handleLoopEditStart}
                  onLoopCommit={handleLoopCommit}
                >
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-surface-input" />
                </Timeline>
              </div>
            ) : (
              <div className="w-full h-8 pt-1 flex items-center justify-center text-sm text-black/40 font-inria">
                Loading video…
              </div>
            )}
          </div>
          </YouTubeSettings>
        </div>

        <PlaybackControls showFreeze={false} disabled={!ready} />
      </div>

      {ready && <Tutorial steps={TUTORIAL_STEPS} />}
    </>
  );
}
