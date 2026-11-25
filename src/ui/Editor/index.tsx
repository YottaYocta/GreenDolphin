import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { buildPeaks, drawWaveform, type Peaks } from "./Timeline/Waveform/peaks";
import { formatSize, formatTime } from "../shared/format";
import { Loading } from "../shared/primitives";
import { clamp } from "./Timeline/geometry";
import { core, type Player } from "../../core";
import type { Section } from "../../core";
import { Controls } from "./Controls";
import { useKeepAwake } from "./keepAwake";
import { Tutorial, type TutorialStep } from "./Tutorial";
import { PianoRoll } from "./PianoRoll";
import { restore, usePersistence, useSound, type SoundOutput } from "./session";
import { GeneralSettings, LoopSettings, SoundSettings, type GeneralPrefs } from "./Controls/Settings";
import { Timeline, type TimelineProps } from "./Timeline";
import { TitleBar } from "./TitleBar";
import { audio, type AudioEngine, type Recording } from "../../audio";
import { youtube } from "../../youtube";
import { setReplay } from "../../analytics";
import { persistence, type StoredRecording } from "../../persistence";

const CARD = "flex flex-col rounded-xl overflow-hidden bg-white";
const COLUMN = "flex flex-col gap-4 max-md:gap-2 min-h-0 has-[[data-fill]]:h-full";

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

interface Session {
  player: Player;
  restored: ReturnType<typeof restore>;
  output: SoundOutput;
}

function Loaded({ recording, info, session, draw, engine, youtube, general }: { recording: StoredRecording; info: [string, string][]; session: Session; draw?: TimelineProps["draw"]; engine?: AudioEngine; youtube: boolean; general: GeneralPrefs }) {
  const { player, restored } = session;
  const [sound, setSound] = useSound(recording.id, restored.sound, session.output);
  const { onView, onLoopCommit } = usePersistence(recording.id, player);
  const settings = <SoundSettings player={player} sound={sound} onSound={setSound} youtube={youtube} />;
  return (
    <>
      <div className={COLUMN}>
        <TitleBar
          recording={recording}
          info={info}
          editor={
            <div className="flex flex-col gap-10">
              <LoopSettings player={player} />
              <GeneralSettings {...general} />
            </div>
          }
        />
        {engine && general.piano && <PianoRoll engine={engine} />}
        <div data-fill className={`${CARD} flex-1 min-h-0 md:min-h-72 p-4`}>
          <Timeline player={player} initialView={restored.view} initialLoop={restored.loopFraction} onView={onView} onLoopCommit={onLoopCommit} draw={draw} />
          {general.inline && <div className="grid md:grid-flow-col md:auto-cols-fr gap-x-8 gap-y-2 shrink-0 pt-4 px-4">{settings}</div>}
        </div>
      </div>
      <Controls player={player} freeze={!youtube} settings={general.inline ? undefined : settings} />
    </>
  );
}

function useEditorPrefs(hasPiano: boolean) {
  const [piano, setPiano] = useState(() => persistence.flag("piano"));
  const [inline, setInline] = useState(() => persistence.flag("inlineSound"));
  const [awake, setAwake] = useState(() => !persistence.flag("allowSleep"));
  useKeepAwake(awake);
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
    inline,
    onInline(next) {
      setInline(next);
      persistence.setFlag("inlineSound", next);
    },
    awake,
    onAwake(next) {
      setAwake(next);
      persistence.setFlag("allowSleep", !next);
    },
    replay,
    onReplay(next) {
      setReplayPref(next);
      setReplay(next);
      persistence.setFlag("noReplay", !next);
    },
    onTutorial: () => setTutorialStep(0),
  };
  return { general, tutorialStep, setTutorialStep };
}

function Layout(props: { recording: StoredRecording; info: [string, string][]; session: Session | null; top?: ReactNode; draw?: TimelineProps["draw"]; engine?: AudioEngine; youtube?: boolean }) {
  const { recording, info, session, top, draw, engine, youtube = false } = props;
  const { general, tutorialStep, setTutorialStep } = useEditorPrefs(!!engine);
  return (
    <>
      <div className="h-dvh flex items-center justify-center">
        <div className="w-full max-w-220 h-full md:h-min p-4 md:p-6 flex flex-col justify-center gap-4 max-md:gap-2 max-md:pt-6 max-md:pb-10">
          {session ? (
            <Loaded recording={recording} info={info} session={session} draw={draw} engine={engine} youtube={youtube} general={general} />
          ) : (
            <div className={COLUMN}>
              <TitleBar recording={recording} info={info} />
              {top}
              <div data-fill className={`${CARD} flex-1 min-h-0 md:min-h-72`} />
            </div>
          )}
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
      restored.options.speed = clamp(Math.round(restored.options.speed * 4) / 4, 0.25, 2);
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

  const info: [string, string][] = [
    ["Source", "YouTube"],
    ["Video ID", videoId],
  ];
  return (
    <>
      <div ref={host} className="absolute size-0 overflow-hidden [&_iframe]:w-80 [&_iframe]:h-45" />
      {session || error !== null ? (
        <Layout recording={recording} info={info} session={session} top={error !== null && <p className={`${CARD} p-4 shrink-0 text-sm text-danger`}>{error}</p>} youtube />
      ) : (
        <Loading />
      )}
    </>
  );
}
