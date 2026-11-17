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
import { GeneralSettings, LoopSettings, SoundSettings, type GeneralPrefs } from "./Controls/Settings";
import { Timeline, type TimelineProps } from "./Timeline";
import { TitleBar } from "./TitleBar";
import { audio, type AudioEngine, type Recording } from "../../audio";
import { youtube } from "../../youtube";
import { setReplay } from "../../analytics";
import { persistence, type RecordingId, type StoredRecording } from "../../persistence";

const CARD = "flex flex-col rounded-xl overflow-hidden [box-shadow:var(--shadow-panel)] bg-white border border-border";

const AUDIO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#waveform-canvas", text: "Pinch to zoom in/out" },
  { selector: "#waveform-canvas", text: "Drag to pan" },
  { selector: "#timeline-loop", text: "Drag the handles to set the loop" },
  { selector: '[aria-label="Editor settings"]', text: "Show the piano roll from editor settings" },
];
const VIDEO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#timeline-loop", text: "Drag the handles to set the loop" },
];

type Restored = ReturnType<typeof restore>;
interface Session {
  player: Player;
  restored: Restored;
  output: SoundOutput;
}

function TimelineCard({ id, player, restored, draw }: { id: RecordingId; player: Player; restored: Restored; draw?: TimelineProps["draw"] }) {
  const { onView, onLoopCommit } = usePersistence(id, player);
  return (
    <div data-fill={draw ? true : undefined} className={`${CARD} ${draw ? "flex-1 min-h-0 md:min-h-72" : "shrink-0"} p-4`}>
      <Timeline player={player} initialView={restored.view} initialLoop={restored.loopFraction} onView={onView} onLoopCommit={onLoopCommit} draw={draw} />
    </div>
  );
}

function EditorControls({ id, session, youtube }: { id: RecordingId; session: Session; youtube: boolean }) {
  const [sound, setSound] = useSound(id, session.restored.sound, session.output);
  return (
    <Controls
      player={session.player}
      freeze={!youtube}
      settings={<SoundSettings player={session.player} sound={sound} onSound={setSound} youtube={youtube} />}
    />
  );
}

function useEditorPrefs(hasPiano: boolean) {
  const [piano, setPiano] = useState(() => persistence.flag("piano"));
  const [awake, setAwake] = useState(() => !persistence.flag("allowSleep"));
  const keepAwake = useCallback((next: boolean) => {
    setAwake(next);
    persistence.setFlag("allowSleep", !next);
  }, []);
  const allowSleep = useCallback(() => keepAwake(false), [keepAwake]);
  const [replay, setReplayPref] = useState(() => !persistence.flag("noReplay"));
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const general: GeneralPrefs = {
    piano: hasPiano && piano,
    onPiano: hasPiano
      ? (next) => {
          setPiano(next);
          persistence.setFlag("piano", next);
        }
      : undefined,
    awake,
    onAwake: keepAwake,
    replay,
    onReplay(next) {
      setReplayPref(next);
      setReplay(next);
      persistence.setFlag("noReplay", !next);
    },
    onTutorial: () => setTutorialStep(0),
  };
  return { general, allowSleep, tutorialStep, setTutorialStep };
}

function Layout(props: { recording: StoredRecording; info: [string, string][]; session: Session | null; top?: ReactNode; draw?: TimelineProps["draw"]; engine?: AudioEngine; youtube?: boolean }) {
  const { recording, info, session, top, draw, engine, youtube = false } = props;
  const { general, allowSleep, tutorialStep, setTutorialStep } = useEditorPrefs(!!engine);
  return (
    <>
      <div className="w-full h-dvh flex flex-col">
        <KeepAwake enabled={general.awake} onUnsupported={allowSleep} />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:pt-6 max-md:pb-10">
            <div className="flex flex-col gap-4 max-md:gap-2 min-h-0 has-[[data-fill]]:h-full">
              <TitleBar
                recording={recording}
                info={info}
                editor={
                  session && (
                    <div className="flex flex-col gap-10">
                      <LoopSettings player={session.player} />
                      <GeneralSettings {...general} />
                    </div>
                  )
                }
              />
              {engine && general.piano && (
                <div className={`${CARD} shrink-0`}>
                  <PianoRoll engine={engine} />
                </div>
              )}
              {top}
              {session ? <TimelineCard id={recording.id} player={session.player} restored={session.restored} draw={draw} /> : <div data-fill={youtube ? undefined : true} className={`${CARD} ${youtube ? "h-28" : "flex-1 min-h-0 md:min-h-72"}`} />}
            </div>
            {session && <EditorControls id={recording.id} session={session} youtube={youtube} />}
          </div>
        </div>
      </div>
      {session && <Tutorial steps={youtube ? VIDEO_STEPS : AUDIO_STEPS} step={tutorialStep} setStep={setTutorialStep} />}
    </>
  );
}

export function AudioEditor({ recording, size, decoded }: { recording: StoredRecording; size: number; decoded: Recording }) {
  const [session, setSession] = useState<(Session & { engine: AudioEngine }) | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);

  useEffect(() => {
    let live = true;
    let made: { engine: AudioEngine; player: Player } | null = null;
    void audio.createEngine(decoded).then((engine) => {
      if (!live) return engine.dispose();
      const restored = restore(recording.id, decoded.duration);
      made = { engine, player: core.createPlayer(engine, restored.options) };
      if (import.meta.env.DEV) Object.assign(window, { __gd: made });
      setSession({ ...made, restored, output: engine });
    });
    void buildPeaks(decoded).then((p) => live && setPeaks(p));
    return () => {
      live = false;
      made?.player.dispose();
      made?.engine.dispose();
    };
  }, [recording.id, decoded]);

  const draw = useCallback((canvas: HTMLCanvasElement, view: Section, loop: Section) => peaks && drawWaveform(canvas, peaks, decoded, view, loop), [peaks, decoded]);
  if (!session) return null;
  const info: [string, string][] = [
    ["Size", formatSize(size)],
    ["Duration", formatTime(decoded.duration)],
    ["Sample rate", `${decoded.sampleRate.toLocaleString()} Hz`],
    ["Channels", String(decoded.channelCount)],
  ];
  return <Layout recording={recording} info={info} session={session} draw={draw} engine={session.engine} />;
}

export function YouTubeEditor({ recording, videoId }: { recording: StoredRecording; videoId: string }) {
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
      const restored = restore(recording.id, output.duration);
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
  }, [recording.id, videoId]);

  const video = (
    <>
      <div className="absolute size-0 overflow-hidden">
        <div ref={host} className="w-80 h-45 [&_iframe]:w-full [&_iframe]:h-full" />
      </div>
      {error !== null && <p className={`${CARD} p-4 shrink-0 text-sm text-red-600/80 font-inria`}>{error}</p>}
      {!session && error === null && <p className={`${CARD} p-4 shrink-0 text-sm text-black/40 font-inria`}>Loading video…</p>}
    </>
  );
  const info: [string, string][] = [
    ["Source", "YouTube"],
    ["Video ID", videoId],
  ];
  return <Layout recording={recording} info={info} session={session} top={video} youtube />;
}
