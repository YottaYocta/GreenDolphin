export type RecordingSeconds = number;
export type ClockSeconds = number;
export type DurationSeconds = number;
export type SpeedRatio = number;

export interface Section {
  start: RecordingSeconds;
  end: RecordingSeconds;
}

export type PlayState = "paused" | "playing" | "frozen" | "waiting";

export type LoopMode = { type: "manual" } | { type: "automatic"; delay: DurationSeconds };

export type TransportEvent =
  | { type: "toggle-play" }
  | { type: "toggle-freeze" }
  | { type: "move"; position: RecordingSeconds }
  | { type: "loop-end" }
  | { type: "delay-end" }
  | { type: "loop-change" };

export interface TransportContext {
  position: RecordingSeconds;
  loop: Section;
  loopMode: LoopMode;
}

export interface Transition {
  state: PlayState;
  position?: RecordingSeconds;
}

export type PlaybackMode = "silent" | "playing" | "frozen" | "scrubbing";

export interface Playback {
  mode: PlaybackMode;
  anchorPosition: RecordingSeconds;
  anchorTime: ClockSeconds;
  rate: SpeedRatio;
  loop: Section;
  loopWraps: boolean;
}

export interface Output {
  now(): ClockSeconds;
  render(playback: Playback): void;
}

export interface TransportState {
  playState: PlayState;
  loop: Section;
  loopMode: LoopMode;
  speed: SpeedRatio;
  waitingUntil: ClockSeconds | null;
}

export interface PlayerOptions {
  duration: DurationSeconds;
  position: RecordingSeconds;
  loop: Section | null;
  loopMode: LoopMode;
  speed: SpeedRatio;
}

export interface Player {
  readonly duration: DurationSeconds;
  subscribe(listener: () => void): () => void;
  getState(): TransportState;
  position(): RecordingSeconds;
  delayRemaining(): DurationSeconds;
  dispatch(event: TransportEvent): void;
  startScrub(at: RecordingSeconds): void;
  scrubTo(at: RecordingSeconds): void;
  endScrub(): void;
  setSpeed(speed: SpeedRatio): void;
  setLoop(loop: Section | null): void;
  setLoopMode(loopMode: LoopMode): void;
  correctPosition(observed: RecordingSeconds): void;
  dispose(): void;
}

export interface Core {
  transition(state: PlayState, event: TransportEvent, context: TransportContext): Transition;
  inLoop(position: RecordingSeconds, loop: Section): boolean;
  loopDelay(mode: LoopMode): DurationSeconds;
  positionAt(playback: Playback, time: ClockSeconds): RecordingSeconds;
  continues(previous: Playback, next: Playback): boolean;
  createPlayer(output: Output, options: PlayerOptions): Player;
}
