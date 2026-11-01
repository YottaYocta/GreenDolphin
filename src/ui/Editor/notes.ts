import type { DurationSeconds, RecordingSeconds, Section, SpeedRatio } from "../../core";
import { persistence, type MidiPitch, type Note, type RecordingId } from "../../persistence";

export const LOW_PITCH = 21;
export const HIGH_PITCH = 108;
export const MIN_NOTE = 0.05;
export const DEFAULT_NOTE = 0.25;
const BLACK = new Set([1, 3, 6, 8, 10]);
const TICKS_PER_SECOND = 960;
const VELOCITY = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const isBlack = (pitch: MidiPitch) => BLACK.has(pitch % 12);
export const pitchFrequency = (pitch: MidiPitch) => 440 * 2 ** ((pitch - 69) / 12);
export const clampPitch = (pitch: MidiPitch) => clamp(pitch, LOW_PITCH, HIGH_PITCH);

export interface NoteStore {
  get(): Note[];
  subscribe(listener: () => void): () => void;
  preview(notes: Note[]): void;
  commit(notes: Note[]): void;
}

export function createNoteStore(id: RecordingId, initial: Note[]): NoteStore {
  let notes = initial;
  const listeners = new Set<() => void>();
  const preview = (next: Note[]) => {
    notes = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => notes,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    preview,
    commit(next) {
      preview(next);
      void persistence.saveNotes(id, next);
    },
  };
}

export type NotePart = "start" | "end" | "body";

export function hitNote(notes: Note[], time: RecordingSeconds, pitch: MidiPitch, edge: DurationSeconds): { note: Note; part: NotePart } | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    const end = note.start + note.length;
    if (note.pitch !== pitch || time < note.start || time > end) continue;
    const grip = Math.min(edge, note.length / 3);
    return { note, part: time <= note.start + grip ? "start" : time >= end - grip ? "end" : "body" };
  }
  return null;
}

export type NoteEdit = "draw" | NotePart;
interface NotePoint {
  time: RecordingSeconds;
  pitch: MidiPitch;
}

export function editNote(kind: NoteEdit, original: Note | null, from: NotePoint, to: NotePoint, duration: DurationSeconds): Note {
  const shift = to.time - from.time;
  if (kind === "draw" || !original) {
    const start = clamp(Math.min(from.time, to.time), 0, duration - MIN_NOTE);
    return { pitch: clampPitch(to.pitch), start, length: clamp(Math.abs(shift), MIN_NOTE, duration - start) };
  }
  const end = original.start + original.length;
  if (kind === "body") return { pitch: clampPitch(original.pitch + to.pitch - from.pitch), start: clamp(original.start + shift, 0, duration - original.length), length: original.length };
  if (kind === "end") return { ...original, length: clamp(original.length + shift, MIN_NOTE, duration - original.start) };
  const start = clamp(original.start + shift, 0, end - MIN_NOTE);
  return { ...original, start, length: end - start };
}

export interface ScheduledNote {
  pitch: MidiPitch;
  delay: DurationSeconds;
  duration: DurationSeconds;
}

interface ScheduleContext {
  position: RecordingSeconds;
  rate: SpeedRatio;
  loop: Section;
  loopWraps: boolean;
}

export function upcomingNotes(notes: Note[], { position, rate, loop, loopWraps }: ScheduleContext, from: RecordingSeconds, to: RecordingSeconds): ScheduledNote[] {
  const span = loop.end - loop.start;
  const found: ScheduledNote[] = [];
  const collect = (first: RecordingSeconds, last: RecordingSeconds, shift: DurationSeconds) => {
    for (const note of notes)
      if (note.start >= first && note.start < last)
        found.push({ pitch: note.pitch, delay: Math.max(0, (note.start + shift - position) / rate), duration: (Math.min(note.start + note.length, loop.end) - note.start) / rate });
  };
  collect(from, Math.min(to, loop.end), 0);
  if (loopWraps && to > loop.end) collect(Math.max(from, loop.end) - span, to - span, span);
  return found;
}

export const soundingNotes = (notes: Note[], { position, rate, loop }: ScheduleContext): ScheduledNote[] =>
  notes
    .filter((note) => note.start < position && position < Math.min(note.start + note.length, loop.end))
    .map((note) => ({ pitch: note.pitch, delay: 0, duration: (Math.min(note.start + note.length, loop.end) - position) / rate }));

const varLength = (value: number) => {
  const bytes = [value & 0x7f];
  for (let rest = value >> 7; rest > 0; rest >>= 7) bytes.unshift((rest & 0x7f) | 0x80);
  return bytes;
};

export function notesToMidi(notes: Note[]): Uint8Array<ArrayBuffer> {
  const ticks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);
  const events = notes
    .flatMap((note) => [
      { tick: ticks(note.start), on: 1, pitch: note.pitch },
      { tick: ticks(note.start + note.length), on: 0, pitch: note.pitch },
    ])
    .sort((a, b) => a.tick - b.tick || a.on - b.on);
  const track = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20];
  let last = 0;
  for (const { tick, on, pitch } of events) {
    track.push(...varLength(tick - last), on ? 0x90 : 0x80, pitch, on ? VELOCITY : 0);
    last = tick;
  }
  track.push(0, 0xff, 0x2f, 0);
  const size = track.length;
  return Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...track]);
}
