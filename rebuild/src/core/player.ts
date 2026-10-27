import { positionAt, type Playback, type PlaybackMode } from "./playback";
import { loopDelay, transition, type LoopMode, type PlayState, type Section, type TransportEvent } from "./transport";

/** Where playback is heard (Web Audio, a video embed, a test double). */
export interface Output {
  /** The output's clock in seconds; trajectories are timed against it. */
  now(): number;
  /** Receives the full description of what to play after every change. */
  render(playback: Playback): void;
}

/** What UIs observe. The moving playhead is read with `player.position()`. */
export interface TransportState {
  playState: PlayState;
  loop: Section;
  loopMode: LoopMode;
  speed: number;
  /** Output clock time the loop delay ends, while waiting. */
  waitingUntil: number | null;
}

export interface PlayerOptions {
  duration: number;
  position: number;
  /** `null` loops the whole recording. */
  loop: Section | null;
  loopMode: LoopMode;
  speed: number;
}

const DUE_SLACK = 0.002;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Playback state manager: transport rules, a clock, loop and delay timers, and scrubbing. */
export class Player {
  readonly duration: number;
  private readonly output: Output;
  private state: TransportState;
  private anchor: { position: number; time: number };
  private playback!: Playback;
  private scrub: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();

  constructor(output: Output, { duration, position, loop, loopMode, speed }: PlayerOptions) {
    this.output = output;
    this.duration = duration;
    this.state = { playState: "paused", loop: loop ?? { start: 0, end: duration }, loopMode, speed, waitingUntil: null };
    this.anchor = { position: clamp(position, 0, duration), time: output.now() };
    this.render();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getState = () => this.state;

  position() {
    return Math.min(this.here(), this.duration);
  }

  delayRemaining() {
    const until = this.state.waitingUntil;
    return until === null ? 0 : Math.max(0, until - this.output.now());
  }

  dispatch(event: TransportEvent) {
    const { playState, loop, loopMode } = this.state;
    const position = this.here();
    const next = transition(playState, event, { position, loop, loopMode });
    this.reanchor(next.position ?? position);
    const waitingUntil = next.state === "waiting" ? this.anchor.time + loopDelay(loopMode) : null;
    this.state = { ...this.state, playState: next.state, waitingUntil };
    this.render();
  }

  scrubTo(position: number) {
    this.scrub = clamp(position, 0, this.duration);
    this.render();
  }

  endScrub() {
    const position = this.scrub;
    if (position === null) return;
    this.scrub = null;
    this.dispatch({ type: "move", position });
  }

  setSpeed(speed: number) {
    this.reanchor(this.here());
    this.state = { ...this.state, speed };
    this.render();
  }

  /** `null` lifts the loop to the whole recording (free playback during gestures). */
  setLoop(loop: Section | null) {
    const next = loop ?? { start: 0, end: this.duration };
    if (next.start === this.state.loop.start && next.end === this.state.loop.end) return;
    this.state = { ...this.state, loop: next };
    this.dispatch({ type: "loop-change" });
  }

  setLoopMode(loopMode: LoopMode) {
    this.reanchor(this.here());
    this.state = { ...this.state, loopMode };
    this.render();
  }

  /** Re-anchors to a position observed on the output (e.g. a video drifting). */
  resync(position: number) {
    this.reanchor(position);
    this.render();
  }

  dispose() {
    clearTimeout(this.timer);
    this.listeners.clear();
    this.output.render({ ...this.playback, mode: "silent" });
  }

  /** Unclamped playhead, computed exactly as outputs compute it. */
  private here() {
    return this.scrub ?? positionAt(this.playback, this.output.now());
  }

  private reanchor(position: number) {
    this.anchor = { position, time: this.output.now() };
  }

  private render() {
    const { playState, loop, loopMode, speed } = this.state;
    const audible = playState === "playing" || playState === "frozen";
    const mode: PlaybackMode =
      this.scrub !== null && audible ? "scrubbing" : playState === "playing" ? "playing" : playState === "frozen" ? "frozen" : "silent";
    this.playback = {
      mode,
      anchorPosition: this.scrub ?? this.anchor.position,
      anchorTime: this.anchor.time,
      rate: speed,
      loop,
      loopWraps: loopMode.type === "automatic" && loopDelay(loopMode) === 0,
    };
    this.output.render(this.playback);
    this.schedule();
    this.listeners.forEach((listener) => listener());
  }

  /** Loop ends only need an event when they change state (manual or delayed loops); wraps are in `positionAt`. */
  private schedule() {
    clearTimeout(this.timer);
    const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = this.playback;
    const { playState, waitingUntil } = this.state;
    let due: number;
    let event: TransportEvent;
    if (mode === "playing" && !loopWraps && anchorPosition < loop.end) {
      due = anchorTime + (loop.end - anchorPosition) / rate;
      event = { type: "loop-end" };
    } else if (playState === "waiting" && waitingUntil !== null) {
      due = waitingUntil;
      event = { type: "delay-end" };
    } else return;
    this.timer = setTimeout(() => {
      if (this.output.now() >= due - DUE_SLACK) this.dispatch(event);
      else this.schedule();
    }, Math.max(0, (due - this.output.now()) * 1000));
  }
}
