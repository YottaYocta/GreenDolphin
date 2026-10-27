import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { buildPeaks, drawWaveform, type Peaks } from "./Timeline/Waveform/peaks";
import { formatSize, formatTime } from "../shared/format";
import { core, type Player } from "../../core";
import type { Section } from "../../core";
import { Controls } from "./Controls";
import { KeepAwake } from "./KeepAwake";
import { Tutorial, type TutorialStep } from "./Tutorial";
import { PianoRoll } from "./PianoRoll";
import { restore, usePersistence, useSound, type SoundOutput } from "./session";
import { LoopSettings, SoundSettings } from "./Controls/Settings";
import { Timeline, type TimelineProps } from "./Timeline";
import { TitleBar } from "./TitleBar";
import { audio, type AudioEngine, type Recording } from "../../audio";
import { youtube } from "../../youtube";

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
interface Session {
  player: Player;
  restored: Restored;
  output: SoundOutput;
}

function TimelineCard({ name, player, restored, draw }: { name: string; player: Player; restored: Restored; draw?: TimelineProps["draw"] }) {
  const { onView, onLoopCommit } = usePersistence(name, player);
  return (
    <div className={`${CARD} ${draw ? "flex-1 min-h-0 md:min-h-72" : "shrink-0"} p-4`}>
      <Timeline player={player} initialView={restored.view} initialLoop={restored.loopFraction} onView={onView} onLoopCommit={onLoopCommit} draw={draw} />
    </div>
  );
}

function EditorControls({ name, session, youtube }: { name: string; session: Session; youtube: boolean }) {
  const [sound, setSound] = useSound(name, session.restored.sound, session.output);
  return (
    <Controls
      player={session.player}
      freeze={!youtube}
      settings={
        <>
          <SoundSettings player={session.player} sound={sound} onSound={setSound} youtube={youtube} />
          <LoopSettings player={session.player} />
        </>
      }
    />
  );
}

function Layout(props: { name: string; info: [string, string][]; session: Session | null; top: ReactNode; draw?: TimelineProps["draw"]; youtube?: boolean }) {
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
          {session && <EditorControls name={name} session={session} youtube={youtube} />}
        </div>
      </div>
      {session && <Tutorial steps={youtube ? VIDEO_STEPS : AUDIO_STEPS} />}
    </>
  );
}

export function AudioEditor({ name, size, recording }: { name: string; size: number; recording: Recording }) {
  const [session, setSession] = useState<(Session & { engine: AudioEngine }) | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);

  useEffect(() => {
    let live = true;
    let made: { engine: AudioEngine; player: Player } | null = null;
    void audio.createEngine(recording).then((engine) => {
      if (!live) return engine.dispose();
      const restored = restore(name, recording.duration);
      made = { engine, player: core.createPlayer(engine, restored.options) };
      if (import.meta.env.DEV) Object.assign(window, { __gd: made });
      setSession({ ...made, restored, output: engine });
    });
    void buildPeaks(recording).then((p) => live && setPeaks(p));
    return () => {
      live = false;
      made?.player.dispose();
      made?.engine.dispose();
    };
  }, [recording, name]);

  const draw = useCallback((canvas: HTMLCanvasElement, view: Section, loop: Section) => peaks && drawWaveform(canvas, peaks, recording, view, loop), [peaks, recording]);
  if (!session) return null;
  const info: [string, string][] = [
    ["Size", formatSize(size)],
    ["Duration", formatTime(recording.duration)],
    ["Sample rate", `${recording.sampleRate.toLocaleString()} Hz`],
    ["Channels", String(recording.channelCount)],
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

export function YouTubeEditor({ name, videoId }: { name: string; videoId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let player: Player | null = null;
    let stopFollowing = () => {};
    const embed = youtube.embed(host.current!, videoId, setError);
    void embed.ready.then((output) => {
      if (!live) return;
      const restored = restore(name, output.duration);
      restored.options.speed = Math.min(2, Math.max(0.25, Math.round(restored.options.speed * 4) / 4));
      restored.sound.gain = Math.min(1, restored.sound.gain);
      player = core.createPlayer(output, restored.options);
      stopFollowing = output.follow(player);
      if (import.meta.env.DEV) Object.assign(window, { __gd: { player } });
      setSession({ player, restored, output });
    });
    return () => {
      live = false;
      stopFollowing();
      player?.dispose();
      embed.dispose();
    };
  }, [name, videoId]);

  const video = (
    <div className={`${CARD} items-center p-4 md:pt-6 shrink min-h-0`}>
      <div className="relative aspect-video h-[min(9rem,18dvh)] md:h-45 max-w-full bg-black rounded-lg overflow-hidden opacity-90">
        <div ref={host} className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full" />
      </div>
      {error !== null && <p className="pt-3 text-sm text-red-600/80 font-inria">{error}</p>}
      {!session && error === null && <p className="pt-3 text-sm text-black/40 font-inria">Loading video…</p>}
    </div>
  );
  const info: [string, string][] = [
    ["Source", "YouTube"],
    ["Video ID", videoId],
  ];
  return <Layout name={name} info={info} session={session} top={video} youtube />;
}
