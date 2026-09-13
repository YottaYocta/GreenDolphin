import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import type { Section } from "../lib/waveform";
import type { WaveformMetadata } from "../components/Waveform/types";
import { AudioStore } from "../AudioStore";
import { PlaybackContext } from "../playback/PlaybackContext";
import { TitleBar } from "../components/TitleBar/TitleBar";
import { Trackbar } from "../components/Waveform/trackbar";
import { Tutorial } from "../components/Tutorial";
import { loadSession, saveSession } from "../lib/useSessionPersistence";
import { loadLoopPrefs } from "../lib/loopPrefs";
import { useFirstVisit } from "../lib/useFirstVisit";
import { useAlwaysAwake } from "../lib/useAlwaysAwake";
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

  const { isFirstVisit: showTutorial, markVisited: markTutorialShown } =
    useFirstVisit();
  const [walkthroughActive, setWalkthroughActive] = useState(false);

  const { activate, method, wakeLockError, videoError } = useAlwaysAwake();

  useEffect(() => {
    activate();
  }, [activate]);

  useEffect(() => {
    saveSession({ filename, audioSettings: playbackSettings });
  }, [filename, playbackSettings]);

  const totalMS = duration * 1000;
  const fullRange = { start: 0, end: totalMS };
  const metadataRef = useRef<WaveformMetadata>({
    viewport: fullRange,
    selection: initialSelection ?? fullRange,
  });

  useEffect(() => {
    if (totalMS <= 0) return;
    const full = { start: 0, end: totalMS };
    const selection = metadataRef.current.selection;
    metadataRef.current = {
      viewport: full,
      selection:
        selection.end > selection.start
          ? clampSection(selection, full)
          : full,
    };
  }, [totalMS]);

  const ready = duration > 0;

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

        <div className="relative flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border shrink-0">
          <YouTubeSettings>
          <div className="w-full flex justify-center p-4 pt-14 md:pt-6">
            <div className="relative w-full max-w-120 aspect-video bg-black rounded-lg overflow-hidden">
              <div
                ref={containerRef}
                className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full"
              />
            </div>
          </div>
          <div className="px-4 pb-4">
            {errorCode !== null ? (
              <div className="w-full h-8 pt-1 flex items-center justify-center text-sm text-red-600/80 font-inria">
                {describeYouTubeError(errorCode)}
              </div>
            ) : ready ? (
              <Trackbar
                positionMS={playbackPosition}
                metadata={metadataRef}
                sampleRate={YOUTUBE_SAMPLE_RATE}
                totalSamples={totalMS}
                handleLoopEdit={(selection) => {
                  metadataRef.current = { ...metadataRef.current, selection };
                }}
                handleLoopEditFinish={(selection) => {
                  metadataRef.current = { ...metadataRef.current, selection };
                  setAudioSettings({ loop: selection });
                  capture("loop_region_set", { source: "youtube" });
                }}
                handlePosition={(positionMS) =>
                  triggerAction({ type: "move", position: positionMS })
                }
                handleRange={(viewport) => {
                  metadataRef.current = { ...metadataRef.current, viewport };
                }}
              />
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
              Would you like a tutorial?
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

      {walkthroughActive && ready && (
        <Tutorial
          handleTutorialFinished={() => {
            capture("tutorial_completed", { source: "youtube" });
            markTutorialShown();
            setWalkthroughActive(false);
          }}
          steps={[
            {
              htmlSelector: "#trackbar",
              contents: <p>Click to set playback position</p>,
            },
            {
              htmlSelector: "#trackbar",
              contents: <p>Drag endpoints to set loop</p>,
            },
          ]}
        />
      )}
    </>
  );
}
