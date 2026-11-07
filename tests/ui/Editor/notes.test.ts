import { expect, test } from "vitest";
import { hitNote, moveNotes, notesInBox, notesToMidi, resizeNote, soundingNotes, upcomingNotes, withEdited } from "../../../src/ui/Editor/notes";

const note = { pitch: 60, start: 1, length: 1 };
const context = { position: 3.9, rate: 2, loop: { start: 3, end: 4 }, loopWraps: true };

test("hit testing finds the note under the point and which part of it", () => {
  expect(hitNote([note], 1.5, 60, 0.1)).toEqual({ note, part: "body" });
  expect(hitNote([note], 1.05, 60, 0.1)?.part).toBe("start");
  expect(hitNote([note], 1.95, 60, 0.1)?.part).toBe("end");
  expect(hitNote([note], 1.5, 61, 0.1)).toBeNull();
  expect(hitNote([note], 2.5, 60, 0.1)).toBeNull();
  expect(hitNote([note], 2.05, 60, 0.1)?.part).toBe("end");
  expect(hitNote([note], 0.95, 60, 0.1)?.part).toBe("start");
  expect(hitNote([note], 2.05, 60, 0)).toBeNull();
});

test("moving and resizing stay inside the recording and the piano", () => {
  const from = { time: 1.5, pitch: 60 };
  expect(moveNotes([note], from, { time: 2, pitch: 62 }, 10)).toEqual([{ pitch: 62, start: 1.5, length: 1 }]);
  expect(moveNotes([note], from, { time: 100, pitch: 500 }, 10)).toEqual([{ pitch: 108, start: 9, length: 1 }]);
  expect(resizeNote("end", note, from, { time: 2, pitch: 60 }, 10).length).toBe(1.5);
  expect(resizeNote("end", note, from, { time: -9, pitch: 60 }, 10).length).toBe(0.05);
  expect(resizeNote("start", note, from, { time: 1, pitch: 60 }, 10)).toEqual({ pitch: 60, start: 0.5, length: 1.5 });
  const shortest = resizeNote("start", note, from, { time: 9, pitch: 60 }, 10);
  expect(shortest.start).toBeCloseTo(1.95);
  expect(shortest.length).toBeCloseTo(0.05);
});

test("a group moves together and stops as a whole at the limits", () => {
  const group = [{ pitch: 60, start: 1, length: 1 }, { pitch: 100, start: 5, length: 2 }];
  const moved = moveNotes(group, { time: 0, pitch: 60 }, { time: 100, pitch: 200 }, 10);
  expect(moved).toEqual([{ pitch: 68, start: 4, length: 1 }, { pitch: 108, start: 8, length: 2 }]);
});

test("a box selects every note it touches", () => {
  const [a, b, c] = [{ pitch: 60, start: 1, length: 1 }, { pitch: 62, start: 1.9, length: 1 }, { pitch: 70, start: 1, length: 1 }];
  expect(notesInBox([a, b, c], { time: 2, pitch: 62 }, { time: 1.5, pitch: 60 })).toEqual([a, b]);
  expect(notesInBox([a, b, c], { time: 5, pitch: 60 }, { time: 6, pitch: 70 })).toEqual([]);
});

test("upcoming notes account for playback speed, the loop end and wrapping", () => {
  const notes = [{ pitch: 60, start: 3.95, length: 1 }, { pitch: 62, start: 3.05, length: 0.1 }, { pitch: 64, start: 3.5, length: 0.1 }];
  const [first, wrapped, ...rest] = upcomingNotes(notes, context, 3.9, 4.1);
  expect(first.pitch).toBe(60);
  expect(first.delay).toBeCloseTo(0.025);
  expect(first.duration).toBeCloseTo(0.025);
  expect(wrapped.pitch).toBe(62);
  expect(wrapped.delay).toBeCloseTo(0.075);
  expect(rest).toEqual([]);
  expect(upcomingNotes(notes, { ...context, loopWraps: false }, 3.9, 4)).toHaveLength(1);
});

test("a note already under the playhead sounds for what remains of it", () => {
  const [sounding] = soundingNotes([{ pitch: 60, start: 3.8, length: 0.2 }], context);
  expect(sounding.delay).toBe(0);
  expect(sounding.duration).toBeCloseTo(0.05);
  expect(soundingNotes([{ pitch: 60, start: 3.95, length: 0.2 }], context)).toEqual([]);
});

test("MIDI export writes a valid single-track file", () => {
  const bytes = notesToMidi([{ pitch: 60, start: 0, length: 1 }, { pitch: 64, start: 0.5, length: 0.25 }]);
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("MThd");
  expect(String.fromCharCode(...bytes.subarray(14, 18))).toBe("MTrk");
  expect(new DataView(bytes.buffer).getUint32(18)).toBe(bytes.length - 22);
  expect([...bytes.subarray(29, 33)]).toEqual([0, 0x90, 60, 80]);
  expect([...bytes.subarray(33, 38)]).toEqual([0x83, 0x60, 0x90, 64, 80]);
  expect([...bytes.subarray(-3)]).toEqual([0xff, 0x2f, 0]);
});

test("notes are delayed to line up with the recording as heard", () => {
  const [scheduled] = upcomingNotes([{ pitch: 60, start: 3.95, length: 0.01 }], { ...context, latency: 0.2 }, 3.9, 4);
  expect(scheduled.delay).toBeCloseTo(0.225);
  expect(soundingNotes([{ pitch: 60, start: 3.8, length: 0.2 }], { ...context, latency: 0.2 })[0].delay).toBe(0.2);
});

test("the edited note trims what it overlaps on its own key and deletes what it covers; chords are fine", () => {
  const n = (pitch: number, start: number, length: number) => ({ pitch, start, length });
  const edited = n(60, 2, 2);
  expect(withEdited([n(60, 1, 2)], [edited])).toEqual([n(60, 1, 1), edited]);
  expect(withEdited([n(60, 3, 2)], [edited])).toEqual([n(60, 4, 1), edited]);
  expect(withEdited([n(60, 2.5, 1)], [edited])).toEqual([edited]);
  expect(withEdited([n(60, 1, 5)], [edited])).toEqual([n(60, 1, 1), edited]);
  expect(withEdited([n(60, 0, 1)], [edited])).toEqual([n(60, 0, 1), edited]);
  expect(withEdited([n(60, 1.98, 1)], [edited])).toEqual([edited]);
  expect(withEdited([n(64, 2, 2)], [edited])).toEqual([n(64, 2, 2), edited]);
});
