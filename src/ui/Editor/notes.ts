import type { DurationSeconds, RecordingSeconds, Section, SpeedRatio } from "../../core";
import { persistence, type MidiPitch, type Note, type RecordingId } from "../../persistence";

export const LOW_PITCH = 21;
export const HIGH_PITCH = 108;
export const MIN_NOTE = 0.05;
export const DEFAULT_NOTE = 0.25;
const HISTORY_LIMIT = 200;
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
  selected(): ReadonlySet<Note>;
  select(notes: Note[]): void;
  preview(notes: Note[], selection?: Note[]): void;
  commit(notes: Note[], selection?: Note[]): void;
  canUndo(): boolean;
  undo(): void;
  redo(): void;
}

export function withEdited(others: Note[], edited: Note[]): Note[] {
  const kept: Note[] = [];
  for (const other of others) {
    let note = other;
    for (const { pitch, start, length } of edited) {
      const [end, otherEnd] = [start + length, note.start + note.length];
      if (pitch !== note.pitch || otherEnd <= start || note.start >= end) continue;
      note = note.start < start ? { ...note, length: start - note.start } : { ...note, start: end, length: otherEnd - end };
    }
    if (note.length >= MIN_NOTE) kept.push(note);
  }
  return [...kept, ...edited];
}

export function withoutOverlaps(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.pitch - b.pitch || a.start - b.start);
  return sorted.flatMap((note, i) => {
    const next = sorted[i + 1];
    const room = next?.pitch === note.pitch ? next.start - note.start : Infinity;
    if (note.length <= room) return [note];
    return room >= MIN_NOTE ? [{ ...note, length: room }] : [];
  });
}

export function createNoteStore(id: RecordingId, saved: Note[]): NoteStore {
  const initial = withoutOverlaps(saved);
  let notes = initial;
  let committed = initial;
  let selection: ReadonlySet<Note> = new Set();
  const undone: Note[][] = [];
  const done: Note[][] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const preview = (next: Note[], nextSelection?: Note[]) => {
    const present = new Set(next);
    notes = next;
    selection = new Set(nextSelection ?? [...selection].filter((note) => present.has(note)));
    emit();
  };
  const restore = (from: Note[][], to: Note[][]) => {
    const previous = from.pop();
    if (!previous) return;
    to.push(committed);
    committed = previous;
    preview(previous, []);
    void persistence.saveNotes(id, previous);
  };
  return {
    get: () => notes,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    selected: () => selection,
    select(next) {
      selection = new Set(next);
      emit();
    },
    preview,
    commit(next, nextSelection) {
      done.push(committed);
      if (done.length > HISTORY_LIMIT) done.shift();
      undone.length = 0;
      committed = next;
      preview(next, nextSelection);
      void persistence.saveNotes(id, next);
    },
    canUndo: () => done.length > 0,
    undo: () => restore(done, undone),
    redo: () => restore(undone, done),
  };
}

export const deleteSelected = (store: NoteStore) => {
  const selected = store.selected();
  if (selected.size > 0) store.commit(store.get().filter((note) => !selected.has(note)));
};

export type NotePart = "start" | "end" | "body";

export function hitNote(notes: Note[], time: RecordingSeconds, pitch: MidiPitch, edge: DurationSeconds): { note: Note; part: NotePart } | null {
  for (const margin of [0, edge]) {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      const end = note.start + note.length;
      if (note.pitch !== pitch || time < note.start - margin || time > end + margin) continue;
      const grip = Math.min(edge, note.length / 3);
      return { note, part: time <= note.start + grip ? "start" : time >= end - grip ? "end" : "body" };
    }
  }
  return null;
}

export type NoteResize = "start" | "end";
export interface NotePoint {
  time: RecordingSeconds;
  pitch: MidiPitch;
}

export function resizeNote(kind: NoteResize, original: Note, from: NotePoint, to: NotePoint, duration: DurationSeconds): Note {
  const shift = to.time - from.time;
  const end = original.start + original.length;
  if (kind === "end") return { ...original, length: clamp(original.length + shift, MIN_NOTE, duration - original.start) };
  const start = clamp(original.start + shift, 0, end - MIN_NOTE);
  return { ...original, start, length: end - start };
}

export function moveNotes(notes: Note[], from: NotePoint, to: NotePoint, duration: DurationSeconds): Note[] {
  const starts = notes.map((note) => note.start);
  const ends = notes.map((note) => note.start + note.length);
  const pitches = notes.map((note) => note.pitch);
  const shift = clamp(to.time - from.time, -Math.min(...starts), duration - Math.max(...ends));
  const climb = clamp(to.pitch - from.pitch, LOW_PITCH - Math.min(...pitches), HIGH_PITCH - Math.max(...pitches));
  return notes.map((note) => ({ ...note, start: note.start + shift, pitch: note.pitch + climb }));
}

export function notesInBox(notes: Note[], a: NotePoint, b: NotePoint): Note[] {
  const [first, last] = [Math.min(a.time, b.time), Math.max(a.time, b.time)];
  const [low, high] = [Math.min(a.pitch, b.pitch), Math.max(a.pitch, b.pitch)];
  return notes.filter((note) => note.pitch >= low && note.pitch <= high && note.start <= last && note.start + note.length >= first);
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
  latency?: DurationSeconds;
}

export function upcomingNotes(notes: Note[], { position, rate, loop, loopWraps, latency = 0 }: ScheduleContext, from: RecordingSeconds, to: RecordingSeconds): ScheduledNote[] {
  const span = loop.end - loop.start;
  const found: ScheduledNote[] = [];
  const collect = (first: RecordingSeconds, last: RecordingSeconds, shift: DurationSeconds) => {
    for (const note of notes)
      if (note.start >= first && note.start < last)
        found.push({ pitch: note.pitch, delay: Math.max(0, (note.start + shift - position) / rate + latency), duration: (Math.min(note.start + note.length, loop.end) - note.start) / rate });
  };
  collect(from, Math.min(to, loop.end), 0);
  if (loopWraps && to > loop.end) collect(Math.max(from, loop.end) - span, to - span, span);
  return found;
}

export const soundingNotes = (notes: Note[], { position, rate, loop, latency = 0 }: ScheduleContext): ScheduledNote[] =>
  notes
    .filter((note) => note.start < position && position < Math.min(note.start + note.length, loop.end))
    .map((note) => ({ pitch: note.pitch, delay: latency, duration: (Math.min(note.start + note.length, loop.end) - position) / rate }));

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
