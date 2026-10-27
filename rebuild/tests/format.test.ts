import { expect, test } from "vitest";
import { formatTick, formatTime, relativeDate, stripExt, tickStep } from "../src/domain/format";
import { parseVideoId } from "../src/youtube/source";

test.each([
  ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"],
  ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://youtu.be/dQw4w9WgXcQ?si=x", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ["https://example.com/watch?v=dQw4w9WgXcQ", null],
  ["not a link", null],
])("parses %s", (input, id) => expect(parseVideoId(input)).toBe(id));

test("formatting", () => {
  expect(stripExt("Song.final.mp3")).toBe("Song.final");
  expect(formatTime(125.9)).toBe("2:05");
  expect(formatTick(65.25, 0.25)).toBe("1:05.3");
  expect(formatTick(59.96, 0.1)).toBe("1:00.0");
  expect(tickStep(60, 600)).toBe(15);
  expect(relativeDate(0, 86_400_000 * 3)).toBe("Added 3 days ago");
});
