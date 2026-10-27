# GreenDolphin (rebuild) — behaviour spec

Local-first looper for learning music by ear. No audio leaves the device.
Every rule here is covered by a unit or end-to-end test.

## Recordings

- Library lists recordings newest first: coloured note icon (hash of the
  name) or YouTube icon, name without extension, relative "Added …" date,
  Play and Delete (Delete asks for confirmation).
- New recording: upload an audio file, or paste a YouTube link (`watch?v=`,
  `youtu.be/`, `/embed/`, `/shorts/`, `/live/`, or a bare 11-char id). Links
  are checked with oEmbed: not embeddable / private / not found are reported;
  the title becomes the recording name.
- Files live in IndexedDB keyed by name; re-adding a name replaces it.
- First visit seeds the demo track without discarding anything already stored.
- Title bar: recordings menu (switch / new), file info dialog, Home.

## Persistence

- Per recording: pitch, speed, volume, loop region, viewport, playback
  position. Switching recordings restores each one's own values.
- Global: loop mode (manual / automatic) and loop delay (fixed seconds or
  relative % of the loop). Editing it anywhere applies to every recording.
- Launch reopens whatever was open last (a recording with its viewport and
  position, or the library).
- Loop delay is always handed to the engine in seconds; fixed/relative is
  presentation only.

## Transport

States: `paused`, `playing`, `frozen`, `waiting` (loop delay countdown).

| event            | paused          | playing                 | frozen  | waiting                 |
|------------------|-----------------|-------------------------|---------|-------------------------|
| play/pause       | playing¹        | paused                  | playing¹| paused @ loop start     |
| freeze           | frozen          | frozen                  | paused  | frozen                  |
| move(p)          | paused @ p      | playing @ p², else start| frozen @ p | playing @ p², else start |
| loop end reached | —               | manual: paused @ start; delay>0: waiting; else playing @ start | — | — |
| delay elapsed    | —               | —                       | —       | playing @ loop start    |
| loop changed     | —               | if p outside loop: start| —       | playing @ loop start    |

¹ from the current position if it lies inside the loop, else the loop start.
² p inside `[loopStart, loopEnd)`.

Loop navigation, spelled out:

- After the loop end, playback always returns to the loop start: delay 0
  wraps seamlessly; delay > 0 counts down (`waiting`) then plays from the
  start; manual mode stops `paused` at the start.
- Clicking outside the loop while `playing` or `waiting` plays from the loop
  start; while `paused` the playhead moves to the click and stays; while
  `frozen` the freeze moves to the click.
- Pressing play with the playhead outside the loop starts at the loop start.

- Freeze is a static snapshot of the moment (phase-locked spectrum).
- Live scrub: dragging the playhead while playing or frozen streams the
  freeze at the drag position; release commits the move (rules above) and
  resumes the previous state. Paused/waiting drags are silent.
- Speed / pitch / volume change live; pitch also applies to the freeze.

## Timeline (local waveform and YouTube)

- Ruler with adaptive time ticks and the playhead grip; content (waveform, or
  grid lines for YouTube); loop band with two handles and a draggable body.
- Tap/click anywhere outside the controls sets the playhead.
- One-pointer drag pans; pinch, ctrl+wheel and trackpad pinch zoom around the
  pointer; horizontal-dominant wheel pans; vertical wheel zooms. Minimum view
  is 0.5% of the recording. Keys: `j`/`k` zoom, `H`/`L` scroll.
- The loop is stored as fractions of the view. Pan keeps it fixed on screen;
  zoom keeps it anchored to the recording, capped to the frame; a full-width
  loop stays full width. Minimum loop is 1% of the view.
- During any viewport or loop gesture the engine loop is lifted (playback
  runs free); the loop under the frame is committed on release (wheel: 250 ms
  after the last event; keyboard: immediately).
- Double-tap / double-click the loop band resets the loop to full width.
- Playhead grip: nothing happens until the pointer moves past the tap
  threshold; dragging past the frame edge clamps inside the frame.
- All pointer input goes through Pointer Events (one path for mouse, touch,
  pen); each drag follows only the pointer that started it.

## Editor extras

- Piano roll: live per-semitone spectrum C2–B8 above a keyboard; press or
  glide across keys to play a sine tone; drag the background to scroll;
  starts centred.
- Controls: play/pause (yellow countdown while waiting), freeze, settings,
  skip ±5 s. Keys: Space/`p` play, `f` freeze, `h`/`l` ±5 s, ←/→ ±0.2 s,
  `0` start. Shortcuts are ignored while typing in a field.
- Settings: pitch ±12 st (0.1), speed 10–190%, volume 0–200% (perceptual),
  each with numeric entry and reset; loop mode and delay.
- First-visit tutorial (restartable), keep-awake indicator with fallback,
  file info, analytics only when enabled by env.

## YouTube

- Embedded player (controls hidden) above the timeline. Speed 0.25–2× in
  0.25 steps, volume 0–100%. No pitch, no freeze.
- The player's clock is followed with a 400 ms drift tolerance; seeks in
  flight (up to 3 s) and seek-induced pauses are ignored; play/pause made in
  the embed is mirrored.

## Code map

```
src/domain/       pure logic, no DOM — unit tested
  transport.ts    the transition table above
  player.ts       Player store: clock, loop/delay timers, scrub; emits one Output
  geometry.ts     view/loop maths (zoom, pan, rescale, fractions)
  format.ts       names, dates, times, ruler ticks
src/audio/        Web Audio backend
  engine.ts       buffer source | freeze worklet → SoundTouch → gain → analyser
  vocoder.ts      phase-locked streaming freeze (runs in freezeProcessor.ts)
  peaks.ts        waveform summary built with copyFromChannel (Brave-safe)
src/youtube/      embed backend (backend.ts) and link/oEmbed/file helpers (source.ts)
src/persistence/  localStorage prefs (per recording + global loop) and IndexedDB files
src/ui/           React: App (library state) → Library | Editor (Timeline, PianoRoll,
                  Controls, Settings, TitleBar); drag.ts / keys.ts input helpers
tests/            vitest unit tests; tests/e2e Playwright (desktop + Pixel 7 touch)
```

Commands (from the repo root): `pnpm rebuild:dev`, `pnpm rebuild:test`,
`pnpm rebuild:e2e`, `pnpm rebuild:build`.
