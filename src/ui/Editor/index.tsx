import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowCounterClockwiseIcon, DownloadSimpleIcon, MusicNotesIcon, PencilSimpleIcon, PianoKeysIcon, TrashIcon } from "@phosphor-icons/react";
import { buildPeaks, drawWaveform, type Peaks } from "./Timeline/Waveform/peaks";
import { formatSize, formatTime, stripExt } from "../shared/format";
import { core, type Player } from "../../core";
import type { Section } from "../../core";
import { Controls } from "./Controls";
import { KeepAwake } from "./KeepAwake";
import { Tutorial, type TutorialStep } from "./Tutorial";
import { createNoteStore, deleteSelected, notesToMidi, type NoteStore } from "./notes";
import { typing } from "../shared/keys";
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
  spectrum?: AudioEngine;
}

const TOOL_BUTTON = "flex items-center justify-center size-9 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-default";

function ToolButton({ label, on, onClick, disabled, children }: { label: string; on?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick} className={`${TOOL_BUTTON} ${on ? "bg-surface-active text-play" : "text-black/40 enabled:hover:bg-black/5"}`}>
      {children}
    </button>
  );
}

function exportMidi(title: string, store: NoteStore) {
  const url = URL.createObjectURL(new Blob([notesToMidi(store.get())], { type: "audio/midi" }));
  Object.assign(document.createElement("a"), { href: url, download: `${stripExt(title)}.mid` }).click();
  URL.revokeObjectURL(url);
}

function TimelineCard({ recording, session, draw }: { recording: StoredRecording; session: Session; draw?: TimelineProps["draw"] }) {
  const { id } = recording;
  const { player, restored, notes, synth, spectrum } = session;
  const { onView, onLoopCommit, onPitchTop } = usePersistence(id, player);
  const [piano, setPiano] = useState(restored.piano);
  const [pen, setPen] = useState(false);
  const [playNotes, setPlayNotes] = useState(restored.playNotes);
  const hasNotes = useSyncExternalStore(notes.subscribe, () => notes.get().length > 0);
  const hasSelection = useSyncExternalStore(notes.subscribe, () => notes.selected().size > 0);
  const canUndo = useSyncExternalStore(notes.subscribe, notes.canUndo);
  useNotePlayback(player, notes, synth, piano && playNotes);
  const roll = useMemo(() => (piano ? { notes, synth, spectrum, pen } : null), [piano, notes, synth, spectrum, pen]);
  useEffect(() => {
    if (!piano) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || typing(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) notes.redo();
      else notes.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piano, notes]);
  const size = !piano ? (draw ? "flex-1 min-h-0 md:min-h-72" : "shrink-0") : draw ? "flex-1 min-h-0 md:min-h-[390px]" : "flex-1 min-h-0 md:min-h-[342px]";
  return (
    <div className={`${CARD} ${size} p-4 pt-2 gap-2`}>
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
          <div className="flex items-center gap-1">
            {hasSelection && (
              <ToolButton label="Delete selected" onClick={() => deleteSelected(notes)}>
                <TrashIcon size={20} weight="fill" />
              </ToolButton>
            )}
            <ToolButton label="Undo" disabled={!canUndo} onClick={notes.undo}>
              <ArrowCounterClockwiseIcon size={20} weight="bold" />
            </ToolButton>
            <ToolButton label="Pen" on={pen} onClick={() => setPen(!pen)}>
              <PencilSimpleIcon size={20} weight="fill" />
            </ToolButton>
            <div className="w-px h-5 mx-1 bg-border-solid" />
            <ToolButton
              label="Play notes"
              on={playNotes}
              onClick={() => {
                setPlayNotes(!playNotes);
                persistence.saveRecordingPrefs(id, { playNotes: !playNotes });
              }}
            >
              <MusicNotesIcon size={20} weight="fill" />
            </ToolButton>
            <ToolButton label="Export notes" disabled={!hasNotes} onClick={() => exportMidi(recording.title, notes)}>
              <DownloadSimpleIcon size={20} weight="bold" />
            </ToolButton>
          </div>
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
          <div className="flex flex-col gap-4 max-md:gap-2 h-full min-h-0">
            <TitleBar recording={recording} info={info} />
            {top}
            {session ? <TimelineCard recording={recording} session={session} draw={draw} /> : <div className={`${CARD} ${youtube ? "h-28" : "flex-1 min-h-0 md:min-h-72"}`} />}
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
      setSession({ ...made, restored, output: engine, synth: engine, spectrum: engine });
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
    <Layout
      recording={recording}
      info={info}
      session={session}
      draw={draw}
    />
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
  return <Layout recording={recording} info={info} session={session} top={video} youtube />;
}
