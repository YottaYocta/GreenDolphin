import type { RefObject } from "react";
import type { DurationSeconds, RecordingSeconds, Section } from "../../../core";
import type { Note } from "../../../persistence";
import { DEFAULT_NOTE, HIGH_PITCH, MIN_NOTE, PITCHES, clampPitch, hitNote, moveNotes, notesInBox, pitchFrequency, resizeNote, withEdited, type NotePoint, type NoteResize, type RollProps } from "../notes";
import { clamp, length } from "./geometry";

export const TAP_PX = 6;
export const DOUBLE_TAP_MS = 300;
const ROW_HEIGHT = { fine: 12, coarse: 18 };
const EDGE_PX = { mouse: 6, touch: 14 };
const MIN_NEW_NOTE_PX = 24;
const CENTRE_PITCH = 60;
const CLICK_SECONDS = 0.2;

export interface TimeAxis {
  m: { view: Section };
  width(): number;
  time(clientX: number): RecordingSeconds;
}

export function createRollLayout(axis: TimeAxis, pane: RefObject<HTMLDivElement | null>, initialTop: number | null, onTop: (top: number) => void) {
  const state = { version: 0, pitchTop: initialTop, noteLength: DEFAULT_NOTE, box: null as [NotePoint, NotePoint] | null };
  const rowHeight = window.matchMedia("(pointer: coarse)").matches ? ROW_HEIGHT.coarse : ROW_HEIGHT.fine;
  const paneHeight = () => pane.current?.clientHeight || 1;
  const clampTop = (top: number) => clamp(top, 0, Math.max(0, PITCHES.length * rowHeight - paneHeight()));
  const top = () => clampTop(state.pitchTop ?? (HIGH_PITCH - CENTRE_PITCH) * rowHeight - paneHeight() / 2);
  const pitch = (clientY: number) => clampPitch(HIGH_PITCH - Math.floor((clientY - (pane.current?.getBoundingClientRect().top ?? 0) + top()) / rowHeight));
  return {
    state,
    rowHeight,
    top,
    point: (clientX: number, clientY: number): NotePoint => ({ time: axis.time(clientX), pitch: pitch(clientY) }),
    edgeSeconds: (pointerType: string) => ((pointerType === "mouse" ? EDGE_PX.mouse : EDGE_PX.touch) / axis.width()) * length(axis.m.view),
    newNoteLength: () => Math.max(state.noteLength, (MIN_NEW_NOTE_PX / axis.width()) * length(axis.m.view)),
    setTop(next: number) {
      state.pitchTop = clampTop(next);
      state.version++;
      onTop(state.pitchTop);
    },
    setBox(box: [NotePoint, NotePoint] | null) {
      state.box = box;
      state.version++;
    },
  };
}

export type RollLayout = ReturnType<typeof createRollLayout>;

type Edit =
  | { kind: NoteResize; original: Note; base: Note[]; from: NotePoint; note: Note }
  | { kind: "move"; moving: Note[]; moved: Note[]; base: Note[]; from: NotePoint }
  | { kind: "box"; from: NotePoint };

export function createNoteEditor({ notes, synth }: RollProps, layout: RollLayout, duration: DurationSeconds) {
  let press: { x: number; y: number; edge: DurationSeconds } | null = null;
  let edit: Edit | null = null;
  let lastTap: { note: Note; time: number } | null = null;
  const click = (pitch: number) => synth.playNote(pitchFrequency(pitch), 0, CLICK_SECONDS);

  const begin = (from: NotePoint, edge: DurationSeconds) => {
    const all = notes.get();
    const hit = hitNote(all, from.time, from.pitch, edge);
    if (!hit) {
      edit = { kind: "box", from };
      return notes.select([]);
    }
    synth.playTone(pitchFrequency(hit.note.pitch));
    if (hit.part === "body") {
      const moving = notes.selected().has(hit.note) ? [...notes.selected()] : [hit.note];
      const others = new Set(moving);
      edit = { kind: "move", moving, moved: moving, base: all.filter((n) => !others.has(n)), from };
      return notes.select(moving);
    }
    edit = { kind: hit.part, original: hit.note, base: all.filter((n) => n !== hit.note), from, note: hit.note };
    notes.select([hit.note]);
  };

  const update = (to: NotePoint) => {
    if (!edit) return;
    if (edit.kind === "box") {
      layout.setBox([edit.from, to]);
      return notes.select(notesInBox(notes.get(), edit.from, to));
    }
    if (edit.kind === "move") {
      const moved = moveNotes(edit.moving, edit.from, to, duration);
      if (moved[0].pitch !== edit.moved[0].pitch) synth.playTone(pitchFrequency(moved[0].pitch));
      edit.moved = moved;
      return notes.preview(withEdited(edit.base, moved), moved);
    }
    edit.note = resizeNote(edit.kind, edit.original, edit.from, to, duration);
    notes.preview(withEdited(edit.base, [edit.note]), [edit.note]);
  };

  const finish = (accepted: boolean) => {
    synth.playTone(null);
    if (edit?.kind === "box") layout.setBox(null);
    if (edit?.kind === "move") {
      if (accepted) notes.commit(withEdited(edit.base, edit.moved), edit.moved);
      else notes.preview([...edit.base, ...edit.moving], edit.moving);
    }
    if (edit && "note" in edit) {
      if (!accepted) notes.preview([...edit.base, edit.original], [edit.original]);
      else {
        layout.state.noteLength = edit.note.length;
        notes.commit(withEdited(edit.base, [edit.note]), [edit.note]);
      }
    }
    edit = null;
  };

  const tap = ({ time, pitch }: NotePoint, timeStamp: number) => {
    const hit = hitNote(notes.get(), time, pitch, 0);
    if (hit) {
      const repeated = lastTap?.note === hit.note && timeStamp - lastTap.time < DOUBLE_TAP_MS;
      lastTap = repeated ? null : { note: hit.note, time: timeStamp };
      if (repeated) return notes.commit(notes.get().filter((n) => n !== hit.note));
      click(hit.note.pitch);
      return notes.select([hit.note]);
    }
    lastTap = null;
    const start = Math.min(time, duration - MIN_NOTE);
    const note = { pitch, start, length: Math.min(layout.newNoteLength(), duration - start) };
    notes.commit(withEdited(notes.get(), [note]), [note]);
    click(pitch);
  };

  return {
    get editing() {
      return edit !== null;
    },
    press(x: number, y: number, pointerType: string) {
      press = { x, y, edge: layout.edgeSeconds(pointerType) };
    },
    drag(x: number, y: number) {
      if (!press) return;
      if (!edit && Math.hypot(x - press.x, y - press.y) <= TAP_PX) return;
      if (!edit) begin(layout.point(press.x, press.y), press.edge);
      update(layout.point(x, y));
    },
    release(accepted: boolean, timeStamp: number) {
      if (edit) finish(accepted);
      else if (press && accepted) tap(layout.point(press.x, press.y), timeStamp);
      press = null;
    },
    cancel() {
      press = null;
    },
    pick(x: number, y: number) {
      const { time, pitch } = layout.point(x, y);
      const hit = hitNote(notes.get(), time, pitch, 0);
      if (hit) {
        click(hit.note.pitch);
        notes.select([hit.note]);
      }
      return !!hit;
    },
    cursor(x: number, y: number) {
      const { time, pitch } = layout.point(x, y);
      const part = hitNote(notes.get(), time, pitch, layout.edgeSeconds("mouse"))?.part;
      return !part ? "" : part === "body" ? "grab" : "ew-resize";
    },
  };
}
