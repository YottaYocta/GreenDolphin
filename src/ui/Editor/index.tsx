import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PianoKeysIcon } from "@phosphor-icons/react";
import { buildPeaks, drawWaveform, type Peaks } from "./Timeline/Waveform/peaks";
import { formatSize, formatTime } from "../shared/format";
import { core, type Player } from "../../core";
import type { Section } from "../../core";
import { Controls } from "./Controls";
import { KeepAwake } from "./KeepAwake";
import { Tutorial, type TutorialStep } from "./Tutorial";
import { createNoteStore, type NoteStore, type Spectrum } from "./notes";
import { NotesToolbar } from "./NotesToolbar";
import { Toggle } from "../shared/primitives";
import { restore, useNotePlayback, usePersistence, useSound, type SoundOutput } from "./session";
import { LoopSettings, SoundSettings } from "./Controls/Settings";
import { Timeline, type TimelineProps } from "./Timeline";
import { TitleBar } from "./TitleBar";
import { audio, type AudioEngine, type NoteSynth, type Recording } from "../../audio";
import { youtube } from "../../youtube";
import { persistence, type RecordingId, type StoredRecording } from "../../persistence";

const CARD = "flex flex-col rounded-xl overflow-hidden [box-shadow:var(--shadow-panel)] bg-white border border-border";

const AUDIO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#waveform-canvas", text: "Pinch to zoom in/out" },
  { selector: "#waveform-canvas", text: "Drag to pan" },
  { selector: "#timeline-loop", text: "The loop stays put — drag the handles or pan the recording under it" },
  { selector: "#piano-toggle", text: "Show the piano to play notes and write them over the recording" },
];
const VIDEO_STEPS: TutorialStep[] = [
  { selector: "#timeline-ruler", text: "Click to set playback position" },
  { selector: "#timeline-loop", text: "The loop stays put — drag the handles or pan the video under it" },
  { selector: "#piano-toggle", text: "Show the piano to play notes and write them over the video" },
];

type Restored = ReturnType<typeof restore>;
interface Session {
  player: Player;
  restored: Restored;
  output: SoundOutput;
  notes: NoteStore;
  synth: NoteSynth;
  spectrum?: Spectrum;
}

function TimelineCard({ recording, session, draw }: { recording: StoredRecording; session: Session; draw?: TimelineProps["draw"] }) {
  const { id } = recording;
  const { player, restored, notes, synth, spectrum } = session;
  const { onView, onLoopCommit, onPitchTop } = usePersistence(id, player);
  const [piano, setPiano] = useState(restored.piano);
  const [pen, setPen] = useState(false);
  const [playNotes, setPlayNotes] = useState(restored.playNotes);
  useNotePlayback(player, notes, synth, piano && playNotes);
  const roll = useMemo(() => (piano ? { notes, synth, spectrum, pen } : null), [piano, notes, synth, spectrum, pen]);
  const size = !piano ? (draw ? "flex-1 min-h-0 md:min-h-72" : "shrink-0") : draw ? "flex-1 min-h-0 md:min-h-[390px]" : "flex-1 min-h-0 md:min-h-[342px]";
  return (
    <div data-fill={piano || draw ? true : undefined} className={`${CARD} ${size} p-4 pt-2 gap-2`}>
      <div className="flex items-center justify-between gap-2 h-9 shrink-0">
        <div className="flex items-center gap-2 text-black/50">
          <PianoKeysIcon size={20} weight="fill" aria-hidden />
          <Toggle
            id="piano-toggle"
            label="Show piano"
            checked={piano}
            onChange={(next) => {
              setPiano(next);
              setPen(false);
              notes.select([]);
              persistence.saveRecordingPrefs(id, { piano: next });
            }}
          />
        </div>
        {piano && (
          <NotesToolbar
            title={recording.title}
            notes={notes}
            pen={pen}
            onPen={setPen}
            playNotes={playNotes}
            onPlayNotes={(next) => {
              setPlayNotes(next);
              persistence.saveRecordingPrefs(id, { playNotes: next });
            }}
          />
        )}
      </div>
      <Timeline player={player} initialView={restored.view} initialLoop={restored.loopFraction} onView={onView} onLoopCommit={onLoopCommit} draw={draw} initialPitchTop={restored.pitchTop} onPitchTop={onPitchTop} roll={roll} />
    </div>
  );
}

function EditorControls({ id, session, youtube }: { id: RecordingId; session: Session; youtube: boolean }) {
  const [sound, setSound] = useSound(id, session.restored.sound, session.output);
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

function Layout(props: { recording: StoredRecording; info: [string, string][]; session: Session | null; top?: ReactNode; draw?: TimelineProps["draw"]; youtube?: boolean }) {
  const { recording, info, session, top, draw, youtube = false } = props;
  return (
    <>
      <KeepAwake />
      <div className="w-full h-dvh flex items-center justify-center">
        <div className="w-full max-w-240 h-full md:h-min min-h-0 p-4 md:p-6 flex flex-col justify-center gap-8 max-md:gap-4 max-md:py-10">
          <div className="flex flex-col gap-4 max-md:gap-2 min-h-0 has-[[data-fill]]:h-full">
            <TitleBar recording={recording} info={info} />
            {top}
            {session ? <TimelineCard recording={recording} session={session} draw={draw} /> : <div data-fill={youtube ? undefined : true} className={`${CARD} ${youtube ? "h-28" : "flex-1 min-h-0 md:min-h-72"}`} />}
          </div>
          {session && <EditorControls id={recording.id} session={session} youtube={youtube} />}
        </div>
      </div>
      {session && <Tutorial steps={youtube ? VIDEO_STEPS : AUDIO_STEPS} />}
    </>
  );
}

export function AudioEditor({ recording, size, decoded }: { recording: StoredRecording; size: number; decoded: Recording }) {
  const [session, setSession] = useState<(Session & { engine: AudioEngine }) | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);

  useEffect(() => {
    let live = true;
    let made: { engine: AudioEngine; player: Player; notes: NoteStore } | null = null;
    void Promise.all([audio.createEngine(decoded), persistence.readNotes(recording.id)]).then(([engine, saved]) => {
      if (!live) return engine.dispose();
      const restored = restore(recording.id, decoded.duration);
      made = { engine, player: core.createPlayer(engine, restored.options), notes: createNoteStore(recording.id, saved) };
      if (import.meta.env.DEV) Object.assign(window, { __gd: made });
      setSession({ ...made, restored, output: engine, synth: engine.synth, spectrum: engine });
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
  return (
    <Layout recording={recording} info={info} session={session} draw={draw} />
  );
}

export function YouTubeEditor({ recording, videoId }: { recording: StoredRecording; videoId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let player: Player | null = null;
    let stopFollowing = () => {};
    const synth = audio.createSynth();
    const embed = youtube.embed(host.current!, videoId, setError);
    void Promise.all([embed.ready, persistence.readNotes(recording.id)]).then(([output, saved]) => {
      if (!live) return;
      const restored = restore(recording.id, output.duration);
      restored.options.speed = Math.min(2, Math.max(0.25, Math.round(restored.options.speed * 4) / 4));
      restored.sound.gain = Math.min(1, restored.sound.gain);
      player = core.createPlayer(output, restored.options);
      stopFollowing = output.follow(player);
      const notes = createNoteStore(recording.id, saved);
      if (import.meta.env.DEV) Object.assign(window, { __gd: { player, notes, synth } });
      setSession({ player, restored, output, notes, synth });
    });
    return () => {
      live = false;
      stopFollowing();
      player?.dispose();
      synth.dispose();
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
