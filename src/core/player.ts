import type { ClockSeconds, Core, DurationSeconds, LoopMode, Output, Playback, PlaybackMode, Player, PlayerOptions, RecordingSeconds, Section, SpeedRatio, TransportEvent, TransportState } from "./interfaces";
import { continues, positionAt } from "./playback";
import { loopDelay, transition } from "./transport";

export const createPlayer: Core["createPlayer"] = (output, options) => new TransportPlayer(output, options);

const DUE_SLACK = 0.002;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

class TransportPlayer implements Player {
  readonly duration: DurationSeconds;
  private readonly output: Output;
  private state: TransportState;
  private loopMode: LoopMode;
  private anchor: { position: RecordingSeconds; time: ClockSeconds };
  private playback!: Playback;
  private audibleFrom: ClockSeconds = -Infinity;
  private retimed: Playback | null = null;
  private scrub: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();

  constructor(output: Output, { duration, position, loop, loopMode, speed }: PlayerOptions) {
    this.output = output;
    this.duration = duration;
    this.state = { playState: "paused", loop, speed };
    this.loopMode = loopMode;
    this.anchor = { position: clamp(position, 0, duration), time: output.now() };
    this.render();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getState = () => this.state;

  position() {
    const { playback } = this;
    if (this.scrub !== null || playback.mode !== "playing") return this.renderedPosition();
    const { loop, loopWraps, anchorPosition } = playback;
    const time = Math.max(this.audibleFrom, this.output.now() - this.output.latency());
    const heard = positionAt(time < playback.anchorTime && this.retimed ? this.retimed : playback, time);
    const unwrapped = loopWraps && heard < loop.start && anchorPosition >= loop.start ? heard + loop.end - loop.start : heard;
    return Math.min(unwrapped, this.duration);
  }

  delayRemaining() {
    const { state } = this;
    return state.playState === "waiting" ? Math.max(0, state.waitingUntil - this.output.now()) : 0;
  }

  dispatch(event: TransportEvent) {
    const { playState, loop, speed } = this.state;
    const { loopMode } = this;
    const now = this.output.now();
    const position = this.here(now);
    const next = transition(playState, event, { position, loop, loopMode });
    this.reanchor(next.position ?? (next.state === "playing" ? position : this.position()), now);
    this.state = next.state === "waiting" ? { loop, speed, playState: next.state, waitingUntil: this.anchor.time + loopDelay(loopMode) } : { loop, speed, playState: next.state };
    this.render();
  }

  startScrub(at: RecordingSeconds) {
    this.scrub = clamp(at, 0, this.duration);
    this.render();
  }

  scrubTo(at: RecordingSeconds) {
    if (this.scrub === null) return;
    this.scrub = clamp(at, 0, this.duration);
    this.render();
  }

  endScrub() {
    const position = this.scrub;
    if (position === null) return;
    this.scrub = null;
    this.dispatch({ type: "move", position });
  }

  setSpeed(speed: SpeedRatio) {
    this.reanchorHere();
    this.state = { ...this.state, speed };
    this.render();
  }

  setLoop(loop: Section, loopMode: LoopMode) {
    const { loop: was } = this.state;
    if (loop.start === was.start && loop.end === was.end && loopMode.type === this.loopMode.type && loopDelay(loopMode) === loopDelay(this.loopMode)) return;
    this.state = { ...this.state, loop };
    this.loopMode = loopMode;
    this.dispatch({ type: "loop-change" });
  }

  correctPosition(observed: RecordingSeconds) {
    this.reanchor(observed);
    this.render();
  }

  dispose() {
    clearTimeout(this.timer);
    this.listeners.clear();
    this.output.render({ ...this.playback, mode: "silent" });
  }

  private renderedPosition() {
    return Math.min(this.here(), this.duration);
  }

  private here(now = this.output.now()) {
    return this.scrub ?? positionAt(this.playback, now);
  }

  private reanchor(position: RecordingSeconds, time = this.output.now()) {
    this.anchor = { position, time };
  }

  private reanchorHere() {
    const now = this.output.now();
    this.reanchor(this.here(now), now);
  }

  private render() {
    const { playState, loop, speed } = this.state;
    const { loopMode } = this;
    const previous = this.playback;
    const mode: PlaybackMode = this.scrub !== null ? "scrubbing" : playState === "playing" ? "playing" : playState === "frozen" ? "frozen" : "silent";
    this.playback = {
      mode,
      anchorPosition: this.scrub ?? this.anchor.position,
      anchorTime: this.anchor.time,
      rate: speed,
      loop,
      loopWraps: loopMode.type === "automatic" && loopDelay(loopMode) === 0,
    };
    const seamless = !!previous && continues(previous, this.playback);
    if (!seamless) this.audibleFrom = this.anchor.time;
    this.retimed = seamless ? previous : null;
    this.output.render(this.playback);
    this.schedule();
    this.listeners.forEach((listener) => listener());
  }

  private schedule() {
    clearTimeout(this.timer);
    const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = this.playback;
    const { state } = this;
    let due: number;
    let event: TransportEvent;
    if (mode === "playing" && !loopWraps && anchorPosition < loop.end) {
      due = anchorTime + (loop.end - anchorPosition) / rate;
      event = { type: "loop-end" };
    } else if (state.playState === "waiting") {
      due = state.waitingUntil;
      event = { type: "delay-end" };
    } else return;
    this.timer = setTimeout(() => {
      if (this.output.now() >= due - DUE_SLACK) this.dispatch(event);
      else this.schedule();
    }, Math.max(0, (due - this.output.now()) * 1000));
  }
}
