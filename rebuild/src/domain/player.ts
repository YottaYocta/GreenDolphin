import { clamp } from "./geometry";
import { loopDelay, transition, type LoopMode, type PlayState, type Section, type TransportEvent } from "./transport";

export interface Settings {
  speed: number;
  pitch: number;
  gain: number;
}

/** What the audio backend should be doing; it diffs successive outputs. */
export interface Output extends Settings {
  mode: "silent" | "play" | "freeze" | "scrub";
  position: number;
  /** Changes whenever output must restart at `position`. */
  generation: number;
  loop: Section;
  /** Backend clock time to stop at (manual or delayed loops); null loops natively. */
  stopAt: number | null;
}

export interface Backend {
  readonly nativeLoop: boolean;
  now(): number;
  apply(output: Output): void;
}

export interface PlayerState extends Settings {
  playState: PlayState;
  loop: Section;
  loopMode: LoopMode;
  waitingUntil: number | null;
}

export interface PlayerInit extends Settings {
  position: number;
  loop: Section | null;
  loopMode: LoopMode;
}

const DUE_SLACK = 0.002;

export class Player {
  readonly duration: number;
  private state: PlayerState;
  private anchor: { position: number; time: number };
  private scrub: number | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private backend: Backend;

  constructor(backend: Backend, duration: number, init: PlayerInit) {
    this.backend = backend;
    this.duration = duration;
    const { position, loop, loopMode, speed, pitch, gain } = init;
    this.state = { playState: "paused", loop: loop ?? this.full(), loopMode, speed, pitch, gain, waitingUntil: null };
    this.anchor = { position: clamp(position, 0, duration), time: backend.now() };
    this.sync();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getState = () => this.state;

  position(): number {
    if (this.scrub !== null) return this.scrub;
    if (this.state.playState !== "playing") return this.anchor.position;
    const elapsed = this.backend.now() - this.anchor.time;
    return Math.min(this.anchor.position + elapsed * this.state.speed, this.duration);
  }

  delayRemaining() {
    const until = this.state.waitingUntil;
    return until === null ? 0 : Math.max(0, until - this.backend.now());
  }

  dispatch(event: TransportEvent) {
    const { playState, loop, loopMode, speed } = this.state;
    const now = this.backend.now();
    const position = this.position();
    const next = transition(playState, event, { position, loop, loopMode });
    if (event.type === "loop-end" && next.state === "playing" && this.backend.nativeLoop) {
      const endTime = this.anchor.time + (loop.end - this.anchor.position) / speed;
      this.anchor = { position: loop.start, time: endTime };
    } else {
      this.anchor = { position: next.position ?? position, time: now };
      if (next.position !== undefined || next.state !== playState) this.generation++;
    }
    const waitingUntil = next.state === "waiting" ? now + loopDelay(loopMode) : null;
    this.set({ playState: next.state, waitingUntil });
  }

  scrubTo(position: number) {
    this.scrub = clamp(position, 0, this.duration);
    this.sync();
  }

  endScrub() {
    const position = this.scrub;
    if (position === null) return;
    this.scrub = null;
    this.dispatch({ type: "move", position });
  }

  setSettings(patch: Partial<Settings>) {
    if (patch.speed !== undefined && this.state.playState === "playing")
      this.anchor = { position: this.position(), time: this.backend.now() };
    this.set(patch);
  }

  /** `null` lifts the loop to the whole recording (free playback during gestures). */
  setLoop(loop: Section | null) {
    const next = loop ?? this.full();
    if (next.start === this.state.loop.start && next.end === this.state.loop.end) return;
    if (this.state.playState === "playing")
      this.anchor = { position: this.position(), time: this.backend.now() };
    this.state = { ...this.state, loop: next };
    this.dispatch({ type: "loop-change" });
  }

  setLoopMode(loopMode: LoopMode) {
    if (this.state.playState === "playing")
      this.anchor = { position: this.position(), time: this.backend.now() };
    this.set({ loopMode });
  }

  /** Re-anchor to an externally observed clock (e.g. a video player) without a transition. */
  resync(position: number) {
    this.anchor = { position, time: this.backend.now() };
    this.sync();
  }

  dispose() {
    clearTimeout(this.timer);
    this.listeners.clear();
    this.backend.apply({ ...this.output(), mode: "silent" });
  }

  private full = (): Section => ({ start: 0, end: this.duration });

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.sync();
  }

  private output(): Output {
    const { playState, loop, loopMode, speed, pitch, gain } = this.state;
    const audible = playState === "playing" || playState === "frozen";
    const mode =
      this.scrub !== null && audible ? "scrub" : playState === "playing" ? "play" : playState === "frozen" ? "freeze" : "silent";
    const stops = mode === "play" && (loopMode.type === "manual" || loopDelay(loopMode) > 0);
    const stopAt = stops ? this.anchor.time + (loop.end - this.anchor.position) / speed : null;
    return { mode, position: this.scrub ?? this.anchor.position, generation: this.generation, loop, stopAt, speed, pitch, gain };
  }

  private sync() {
    this.backend.apply(this.output());
    this.schedule();
    this.listeners.forEach((listener) => listener());
  }

  private schedule() {
    clearTimeout(this.timer);
    const { playState, loop, speed, waitingUntil } = this.state;
    let due: number;
    let event: TransportEvent;
    if (playState === "playing" && this.scrub === null) {
      due = this.anchor.time + (loop.end - this.anchor.position) / speed;
      event = { type: "loop-end" };
    } else if (playState === "waiting" && waitingUntil !== null) {
      due = waitingUntil;
      event = { type: "delay-end" };
    } else return;
    const wait = Math.max(0, (due - this.backend.now()) * 1000);
    this.timer = setTimeout(() => {
      if (this.backend.now() >= due - DUE_SLACK) this.dispatch(event);
      else this.schedule();
    }, wait);
  }
}
