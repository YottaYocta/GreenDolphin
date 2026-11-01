import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DurationSeconds, Player, PlayerOptions, Section } from "../../core";
import { FULL, clamp, fit, length, toFraction, toSection } from "./Timeline/geometry";
import { persistence, type RecordingId } from "../../persistence";
import type { NoteSynth } from "../../audio";
import { pitchFrequency, soundingNotes, upcomingNotes, type NoteStore } from "./notes";

export const usePlayer = (player: Player) => useSyncExternalStore(player.subscribe, player.getState);

export interface Sound {
  pitch: number;
  gain: number;
}

export interface SoundOutput {
  setVolume(gain: number): void;
  setPitch?(semitones: number): void;
}

export function restore(id: RecordingId, duration: DurationSeconds) {
  const p = persistence.recordingPrefs(id);
  const full = { start: 0, end: duration };
  const view = p.view ? fit(p.view, full) : full;
  const loopFraction = p.loop ? toFraction(view, p.loop) : FULL;
  const loop = toSection(view, loopFraction);
  const options: PlayerOptions = {
    duration,
    position: clamp(p.position, 0, duration),
    loop,
    loopMode: persistence.toLoopMode(persistence.loopPrefs(), length(loop)),
    speed: p.speed,
  };
  const sound: Sound = { pitch: p.pitch, gain: p.gain };
  return { view, loopFraction, options, sound, piano: p.piano, playNotes: p.playNotes, pitchTop: p.pitchTop };
}

export function useSound(id: RecordingId, initial: Sound, output: SoundOutput) {
  const [sound, setSound] = useState(initial);
  useEffect(() => {
    output.setPitch?.(sound.pitch);
    output.setVolume(sound.gain);
    persistence.saveRecordingPrefs(id, sound);
  }, [id, output, sound]);
  return [sound, setSound] as const;
}

const POSITION_SAVE_MS = 1000;
const VIEW_SAVE_MS = 250;

export function usePersistence(id: RecordingId, player: Player) {
  const state = usePlayer(player);
  const { speed, loop, playState } = state;

  useEffect(() => persistence.saveRecordingPrefs(id, { speed }), [id, speed]);
  useEffect(() => player.setLoopMode(persistence.toLoopMode(persistence.loopPrefs(), length(loop))), [player, loop]);
  useEffect(() => {
    const save = () => persistence.saveRecordingPrefs(id, { position: player.position() });
    save();
    const interval = playState === "playing" ? setInterval(save, POSITION_SAVE_MS) : undefined;
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      save();
      clearInterval(interval);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [id, player, playState]);

  return useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let topTimer: ReturnType<typeof setTimeout> | undefined;
    return {
      onView: (view: Section) => {
        clearTimeout(timer);
        timer = setTimeout(() => persistence.saveRecordingPrefs(id, { view }), VIEW_SAVE_MS);
      },
      onLoopCommit: (loop: Section) => persistence.saveRecordingPrefs(id, { loop }),
      onPitchTop: (pitchTop: number) => {
        clearTimeout(topTimer);
        topTimer = setTimeout(() => persistence.saveRecordingPrefs(id, { pitchTop }), VIEW_SAVE_MS);
      },
    };
  }, [id]);
}

const NOTE_TICK_MS = 25;
const NOTE_LOOKAHEAD = 0.15;

export function useNotePlayback(player: Player, notes: NoteStore, synth: NoteSynth, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let until: number | null = null;
    let last = 0;
    const tick = () => {
      const { mode, rate, loop, loopWraps } = player.getPlayback();
      if (mode !== "playing") {
        until = null;
        return;
      }
      const position = player.renderedPosition();
      const context = { position, rate, loop, loopWraps, latency: player.latency() };
      const span = loop.end - loop.start;
      const play = (scheduled: ReturnType<typeof upcomingNotes>) => scheduled.forEach((note) => synth.playNote(pitchFrequency(note.pitch), note.delay, note.duration));
      if (until === null) {
        until = position;
        play(soundingNotes(notes.get(), context));
      } else if (position < last) until -= span;
      last = position;
      const horizon = Math.min(position + NOTE_LOOKAHEAD * rate, loopWraps ? loop.end + span : loop.end);
      play(upcomingNotes(notes.get(), context, until, horizon));
      until = Math.max(until, horizon);
    };
    const unsubscribe = player.subscribe(() => {
      until = null;
      synth.stopNotes();
    });
    const timer = setInterval(tick, NOTE_TICK_MS);
    tick();
    return () => {
      unsubscribe();
      clearInterval(timer);
      synth.stopNotes();
    };
  }, [player, notes, synth, on]);
}
