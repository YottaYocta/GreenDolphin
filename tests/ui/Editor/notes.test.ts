import { expect, test } from "vitest";
import { editNote, hitNote, notesToMidi, soundingNotes, upcomingNotes } from "../../../src/ui/Editor/notes";

const note = { pitch: 60, start: 1, length: 1 };
const context = { position: 3.9, rate: 2, loop: { start: 3, end: 4 }, loopWraps: true };

test("hit testing finds the note under the point and which part of it", () => {
  expect(hitNote([note], 1.5, 60, 0.1)).toEqual({ note, part: "body" });
  expect(hitNote([note], 1.05, 60, 0.1)?.part).toBe("start");
  expect(hitNote([note], 1.95, 60, 0.1)?.part).toBe("end");
  expect(hitNote([note], 1.5, 61, 0.1)).toBeNull();
  expect(hitNote([note], 2.5, 60, 0.1)).toBeNull();
});

test("drawing spans the drag in either direction and follows the pitch", () => {
  expect(editNote("draw", null, { time: 2, pitch: 60 }, { time: 3, pitch: 62 }, 10)).toEqual({ pitch: 62, start: 2, length: 1 });
  expect(editNote("draw", null, { time: 2, pitch: 60 }, { time: 1, pitch: 60 }, 10)).toEqual({ pitch: 60, start: 1, length: 1 });
});

test("moving and resizing stay inside the recording and the piano", () => {
  const from = { time: 1.5, pitch: 60 };
  expect(editNote("body", note, from, { time: 2, pitch: 62 }, 10)).toEqual({ pitch: 62, start: 1.5, length: 1 });
  expect(editNote("body", note, from, { time: 100, pitch: 500 }, 10)).toEqual({ pitch: 108, start: 9, length: 1 });
  expect(editNote("end", note, from, { time: 2, pitch: 60 }, 10).length).toBe(1.5);
  expect(editNote("end", note, from, { time: -9, pitch: 60 }, 10).length).toBe(0.05);
  expect(editNote("start", note, from, { time: 1, pitch: 60 }, 10)).toEqual({ pitch: 60, start: 0.5, length: 1.5 });
  const shortest = editNote("start", note, from, { time: 9, pitch: 60 }, 10);
  expect(shortest.start).toBeCloseTo(1.95);
  expect(shortest.length).toBeCloseTo(0.05);
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
