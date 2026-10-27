import type { LoopMode, PlayState, RecordingSeconds, Section, Transition, TransportContext, TransportEvent } from "./interfaces";

export const inLoop = (position: RecordingSeconds, loop: Section) =>
  position >= loop.start && position < loop.end;

export const loopDelay = (mode: LoopMode) => (mode.type === "automatic" ? mode.delay : 0);

export function transition(state: PlayState, event: TransportEvent, ctx: TransportContext): Transition {
  const { position, loop, loopMode } = ctx;
  const fromHere = inLoop(position, loop) ? {} : { position: loop.start };
  switch (event.type) {
    case "toggle-play":
      if (state === "playing") return { state: "paused" };
      if (state === "waiting") return { state: "paused", position: loop.start };
      return { state: "playing", ...fromHere };
    case "toggle-freeze":
      return { state: state === "frozen" ? "paused" : "frozen" };
    case "move": {
      const p = event.position;
      if (state === "paused" || state === "frozen") return { state, position: p };
      return { state: "playing", position: inLoop(p, loop) ? p : loop.start };
    }
    case "loop-end":
      if (state !== "playing") return { state };
      if (loopMode.type === "manual") return { state: "paused", position: loop.start };
      if (loopDelay(loopMode) > 0) return { state: "waiting", position: loop.end };
      return { state: "playing", position: loop.start };
    case "delay-end":
      return state === "waiting" ? { state: "playing", position: loop.start } : { state };
    case "loop-change":
      if (state === "waiting") return { state: "playing", position: loop.start };
      if (state === "playing") return { state, ...fromHere };
      return { state };
  }
}
