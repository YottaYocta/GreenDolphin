import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AudioEngine } from "../audio/engine";
import { buildPeaks, drawWaveform, type Peaks } from "../audio/peaks";
import { formatSize, formatTime } from "../domain/format";
import { Player } from "../domain/player";
import type { Section } from "../domain/transport";
import { YouTubeBackend, describeYouTubeError, loadYouTubeApi, type YTPlayer } from "../youtube/backend";
import type { YouTubeSource } from "../youtube/source";
import { Controls } from "./Controls";
import { KeepAwake, Tutorial, type TutorialStep } from "./extras";
import { PianoRoll } from "./PianoRoll";
import { restore, usePersistence } from "./session";
import { LoopSettings, SoundSettings } from "./Settings";
import { Timeline, type TimelineProps } from "./Timeline";
import { TitleBar } from "./TitleBar";

const CARD = "flex flex-col rounded-xl overflow-hidden [box-shadow:var(--shadow-panel)] bg-white border border-border";

const AUDIO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#waveform-canvas", text: "Pinch to zoom in/out" },
  { selector: "#waveform-canvas", text: "Drag to pan" },
  { selector: "#timeline-loop", text: "The loop stays put — drag the handles or pan the recording under it" },
  { selector: "#piano", text: "Click on piano to play note" },
];
const VIDEO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#timeline-loop", text: "The loop stays put — drag the handles or pan the video under it" },
];

type Restored = ReturnType<typeof restore>;

function TimelineCard({ name, player, restored, draw }: { name: string; player: Player; restored: Restored; draw?: TimelineProps["draw"] }) {
  const { onView, onLoopCommit } = usePersistence(name, player);
  return (
    <div className={`${CARD} ${draw ? "flex-1 min-h-0 md:min-h-72" : "shrink-0"} p-4`}>
      <Timeline player={player} initialView={restored.view} initialLoop={restored.loopFraction} onView={onView} onLoopCommit={onLoopCommit} draw={draw} />
    </div>
  );
}

/** Editor page; `top` keeps its place while the player loads so an embedded video is never remounted. */
function Layout(props: { name: string; info: [string, string][]; session: { player: Player; restored: Restored } | null; top: ReactNode; draw?: TimelineProps["draw"]; youtube?: boolean }) {
  const { name, info, session, top, draw, youtube = false } = props;
  return (
    <>
      <KeepAwake />
      <div className="w-full h-dvh flex items-center justify-center">
        <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
          <div className="flex flex-col gap-4 max-md:gap-2 h-full min-h-0">
            <TitleBar name={name} info={info} />
            {top}
            {session ? <TimelineCard name={name} player={session.player} restored={session.restored} draw={draw} /> : <div className={`${CARD} ${youtube ? "h-28" : "flex-1 min-h-0 md:min-h-72"}`} />}
          </div>
          {session && (
            <Controls
              player={session.player}
              freeze={!youtube}
              settings={
                <>
                  <SoundSettings player={session.player} youtube={youtube} />
                  <LoopSettings player={session.player} />
                </>
              }
            />
          )}
        </div>
      </div>
      {session && <Tutorial steps={youtube ? VIDEO_STEPS : AUDIO_STEPS} />}
    </>
  );
}

export function AudioEditor({ name, size, buffer, ctx }: { name: string; size: number; buffer: AudioBuffer; ctx: AudioContext }) {
  const [session, setSession] = useState<{ engine: AudioEngine; player: Player; restored: Restored } | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);

  useEffect(() => {
    let live = true;
    let made: { engine: AudioEngine; player: Player } | null = null;
    void AudioEngine.create(ctx, buffer).then((engine) => {
      if (!live) return engine.dispose();
      const restored = restore(name, buffer.duration);
      made = { engine, player: new Player(engine, buffer.duration, restored.init) };
      if (import.meta.env.DEV) Object.assign(window, { __gd: made });
      setSession({ ...made, restored });
    });
    void buildPeaks(buffer).then((p) => live && setPeaks(p));
    return () => {
      live = false;
      made?.player.dispose();
      made?.engine.dispose();
    };
  }, [ctx, buffer, name]);

  const draw = useCallback((canvas: HTMLCanvasElement, view: Section, loop: Section) => peaks && drawWaveform(canvas, peaks, buffer, view, loop), [peaks, buffer]);
  if (!session) return null;
  const info: [string, string][] = [
    ["Size", formatSize(size)],
    ["Duration", formatTime(buffer.duration)],
    ["Sample rate", `${buffer.sampleRate.toLocaleString()} Hz`],
    ["Channels", String(buffer.numberOfChannels)],
  ];
  return (
    <Layout
      name={name}
      info={info}
      session={session}
      draw={draw}
      top={
        <div className="flex flex-col rounded-xl overflow-hidden [box-shadow:var(--shadow-panel)] bg-white border border-border shrink-0">
          <PianoRoll engine={session.engine} />
        </div>
      }
    />
  );
}

export function YouTubeEditor({ name, source }: { name: string; source: YouTubeSource }) {
  const host = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{ backend: YouTubeBackend; player: Player; restored: Restored } | null>(null);
  const [error, setError] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    let yt: YTPlayer | null = null;
    let made: { backend: YouTubeBackend; player: Player } | null = null;
    const el = host.current!.appendChild(document.createElement("div"));
    const start = (target: YTPlayer) => {
      const duration = target.getDuration();
      if (!live || made || duration <= 0) return;
      const restored = restore(name, duration);
      restored.init.speed = Math.min(2, Math.max(0.25, Math.round(restored.init.speed * 4) / 4));
      restored.init.gain = Math.min(1, restored.init.gain);
      const backend = new YouTubeBackend(target);
      made = { backend, player: new Player(backend, duration, restored.init) };
      if (import.meta.env.DEV) Object.assign(window, { __gd: made });
      setSession({ ...made, restored });
    };
    void loadYouTubeApi().then((YT) => {
      if (!live) return;
      yt = new YT.Player(el, {
        videoId: source.videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: ({ target }) => start(target),
          onStateChange: ({ data }) => (made ? made.backend.onStateChange(data, made.player) : yt && start(yt)),
          onError: ({ data }) => live && setError(data),
        },
      });
    });
    return () => {
      live = false;
      made?.player.dispose();
      try {
        yt?.destroy();
      } catch {
        /* player already gone */
      }
      el.remove();
    };
  }, [name, source.videoId]);

  useEffect(() => {
    if (!session) return;
    let raf = 0;
    const follow = () => {
      session.backend.follow(session.player);
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const video = (
    <div className={`${CARD} items-center p-4 md:pt-6 shrink min-h-0`}>
      <div className="relative aspect-video h-[min(9rem,18dvh)] md:h-45 max-w-full bg-black rounded-lg overflow-hidden opacity-90">
        <div ref={host} className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full" />
      </div>
      {error !== null && <p className="pt-3 text-sm text-red-600/80 font-inria">{describeYouTubeError(error)}</p>}
      {!session && error === null && <p className="pt-3 text-sm text-black/40 font-inria">Loading video…</p>}
    </div>
  );
  const info: [string, string][] = [
    ["Source", "YouTube"],
    ["Video ID", source.videoId],
  ];
  return <Layout name={name} info={info} session={session} top={video} youtube />;
}
