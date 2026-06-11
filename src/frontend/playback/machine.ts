import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import { computeMS } from "../lib/util";

export interface MachineContext {
  sampleRate: number;
  duration: number;
  loop: Section | undefined;
  loopDelay: number;
  currentPositionMS: number;
}

export type UserEvent =
  | { type: "play-pause" }
  | { type: "freeze" }
  | { type: "move"; positionMS: number };

export type InternalEvent = { type: "reach-end" } | { type: "delay-end" };

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
          return { nextState: "paused" };
        case "frozen":
        case "paused": {
          const pos = ctx.currentPositionMS;
          if (pos >= endMS)
            return { nextState: "playing", nextPositionMS: startMS };
          return { nextState: "playing" };
        }
        case "waiting":
          return { nextState: "paused", nextPositionMS: startMS };
      }
      break;
    case "freeze":
      switch (state) {
        case "frozen":
          return { nextState: "paused" };
        case "playing":
        case "paused":
        case "waiting":
          return { nextState: "frozen" };
      }
      break;
    case "move":
      {
        const pos = Math.max(
          0,
          Math.min(event.positionMS, ctx.duration * 1000),
        );

        switch (state) {
          case "frozen":
            return { nextState: "frozen", nextPositionMS: pos };
          case "paused":
            return { nextState: "paused", nextPositionMS: pos };
          case "playing":
          case "waiting":
            if (pos >= startMS && pos < endMS)
              return { nextState: "playing", nextPositionMS: pos };
            else return { nextState: "playing", nextPositionMS: startMS };
        }
      }
      break;
    case "reach-end":
      switch (state) {
        case "playing":
          if (hasDelay) return { nextState: "waiting", nextPositionMS: endMS };
          return { nextState: "playing", nextPositionMS: startMS };

        case "paused":
        case "frozen":
        case "waiting":
          throw new Error(
            `reach-end fired in state "${state}" — rAF should not be running here. ctx: ${JSON.stringify(ctx)}`,
          );
      }
      break;
    case "delay-end":
      switch (state) {
        case "playing":
        case "paused":
        case "frozen":
          throw new Error(
            `delay-end fired in state "${state}" — timer should not be running here. ctx: ${JSON.stringify(ctx)}`,
          );
        case "waiting":
          return { nextState: "playing", nextPositionMS: startMS };
      }
  }
}
