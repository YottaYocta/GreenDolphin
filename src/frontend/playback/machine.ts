import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import { computeMS } from "../lib/util";

export interface MachineContext {
  sampleRate: number;
  duration: number;
  loop: Section | undefined;
  loopDelay: number;
}

export type UserEvent =
  | { type: "play-pause" }
  | { type: "freeze" }
  | { type: "move"; positionMS: number };

type InternalEvent = { type: "reach-end" } | { type: "delay-end" };

export type ClockEvent = UserEvent | InternalEvent;

export interface Transition {
  nextState: PlayState;
  nextPositionMS?: number;
}

function loopBounds(ctx: MachineContext): { startMS: number; endMS: number } {
  return {
    startMS: ctx.loop ? computeMS(ctx.sampleRate, ctx.loop.start) : 0,
    endMS: ctx.loop
      ? computeMS(ctx.sampleRate, ctx.loop.end)
      : ctx.duration * 1000,
  };
}

export function reduce(
  state: PlayState,
  event: ClockEvent,
  ctx: MachineContext,
): Transition {
  const { startMS, endMS } = loopBounds(ctx);
  const hasDelay = ctx.loopDelay > 0;

  switch (event.type) {
    case "play-pause":
      switch (state) {
        case "playing":
        case "frozen":
          return { nextState: "paused" };
        case "paused":
          return { nextState: "playing" };
        case "waiting":
          return { nextState: "paused", nextPositionMS: startMS };
      }
    case "freeze":
      switch (state) {
        case "frozen":
          return { nextState: "paused" };
        default:
          return { nextState: "frozen" };
      }
    case "move": {
      const pos = Math.max(0, Math.min(event.positionMS, ctx.duration * 1000));

      switch (state) {
        case "frozen":
        case "paused":
          return { nextState: "frozen", nextPositionMS: pos };
        case "playing":
        case "waiting":
          if (pos >= startMS && pos < endMS)
            return { nextState: "playing", nextPositionMS: pos };
          else if (pos < startMS)
            return { nextState: "playing", nextPositionMS: startMS };
          else return { nextState: "waiting", nextPositionMS: startMS };
      }
    }
    case "reach-end":
      switch (state) {
        case "playing":
          if (hasDelay)
            return { nextState: "waiting", nextPositionMS: startMS };
          return { nextState: "playing", nextPositionMS: startMS };

        case "paused":
        case "frozen":
        case "waiting":
          throw "Should not be possible to reach end in these states. Something has gone wrong";
      }

    case "delay-end":
      switch (state) {
        case "playing":
        case "paused":
        case "frozen":
          throw "Shoud not be possible to reach delay end in these states. Something has gone wrong";
        case "waiting":
          return { nextState: "playing", nextPositionMS: startMS };
      }
  }
}
