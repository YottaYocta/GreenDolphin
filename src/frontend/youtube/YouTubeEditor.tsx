import { useContext, useEffect, useMemo } from "react";
import type { RefObject } from "react";
import { AudioStore } from "../AudioStore";
import { PlaybackContext } from "../playback/PlaybackContext";
import { TitleBar } from "../components/TitleBar/TitleBar";
import { loadSession, saveSession } from "../lib/useSessionPersistence";
import { capture } from "../lib/posthog";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { YouTubePlaybackProvider } from "./YouTubePlaybackProvider";
import { YouTubeScrubber } from "./YouTubeScrubber";
import { YouTubeControls } from "./YouTubeControls";
import { YouTubeSettings } from "./YouTubeSettings";

export const YouTubeEditor = () => {
  const { video } = useContext(AudioStore);
  if (!video)
    throw new Error("YouTubeEditor must be rendered within a video route");

  const { containerRef, player, duration, subscribe } = useYouTubePlayer(
    video.videoId,
  );

  const initialSettings = useMemo(() => {
    const session = loadSession();
    return session?.filename === video.filename
      ? session.audioSettings
      : undefined;
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
        filename={video.filename}
      />
    </YouTubePlaybackProvider>
  );
};

function YouTubeEditorView({
  containerRef,
  duration,
  filename,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  duration: number;
  filename: string;
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

  const initialSelection = useMemo(() => {
    const session = loadSession();
    return session?.filename === filename
      ? session.audioSettings?.loop
      : undefined;
  }, [filename]);

  const ready = duration > 0;

  return (
    <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
      <TitleBar />

      <div className="relative flex flex-col rounded-xl overflow-x-hidden overflow-y-clip [box-shadow:var(--shadow-panel)] bg-white border border-border shrink-0">
        <YouTubeSettings>
        <div className="w-full flex justify-center p-4">
          <div className="relative w-full max-w-120 aspect-video bg-black rounded-lg overflow-hidden">
            <div
              ref={containerRef}
              className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full"
            />
          </div>
        </div>
        <div className="px-4 pb-4">
          {ready ? (
            <YouTubeScrubber
              totalMS={duration * 1000}
              positionMS={playbackPosition}
              initialSelection={initialSelection}
              handleSelection={(selection) => {
                setAudioSettings({ loop: selection });
                capture("loop_region_set", { source: "youtube" });
              }}
              handlePosition={(positionMS) =>
                triggerAction({ type: "move", position: positionMS })
              }
            />
          ) : (
            <div className="w-full h-8 pt-1 flex items-center justify-center text-sm text-black/40 font-inria">
              Loading video…
            </div>
          )}
        </div>
        </YouTubeSettings>
      </div>

      <YouTubeControls disabled={!ready} />
    </div>
  );
}
