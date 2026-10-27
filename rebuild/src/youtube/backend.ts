import { continues, positionAt, type ClockSeconds, type DurationSeconds, type Output, type Playback, type Player, type RecordingSeconds, type SpeedRatio } from "../core";

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(position: RecordingSeconds, allowSeekAhead: boolean): void;
  getCurrentTime(): RecordingSeconds;
  getDuration(): DurationSeconds;
  setPlaybackRate(rate: SpeedRatio): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (e: { target: YTPlayer }) => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<YTNamespace> | null = null;
export const loadYouTubeApi = () =>
  (api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    document.head.appendChild(Object.assign(document.createElement("script"), { src: "https://www.youtube.com/iframe_api" }));
  }));

export function describeYouTubeError(code: number) {
  if (code === 2) return "That video link looks invalid.";
  if (code === 100) return "This video was removed or is private.";
  if (code === 101 || code === 150) return "The owner of this video doesn't allow it to be played outside YouTube.";
  return "This video couldn't be played.";
}

export const YT_PLAYING = 1;
export const YT_PAUSED = 2;
const DRIFT = 0.4;
const SEEK_TIMEOUT = 3;

export class YouTubeBackend implements Output {
  private last: Playback | null = null;
  private seek: { position: RecordingSeconds; at: ClockSeconds } | null = null;
  private pausedAt = -Infinity;
  private readonly yt: YTPlayer;

  constructor(yt: YTPlayer) {
    this.yt = yt;
  }

  now = () => performance.now() / 1000;

  render(p: Playback) {
    const prev = this.last;
    this.last = p;
    const modeChanged = !prev || prev.mode !== p.mode;
    if (modeChanged || !continues(prev!, p)) {
      const target = positionAt(p, this.now());
      if (modeChanged || Math.abs(this.yt.getCurrentTime() - target) > DRIFT) this.seekTo(target);
      if (modeChanged && p.mode === "playing") this.yt.playVideo();
      else if (modeChanged) {
        this.pausedAt = this.now();
        this.yt.pauseVideo();
      }
    }
    this.yt.setPlaybackRate(p.rate);
  }

  setVolume(gain: number) {
    this.yt.setVolume(Math.round(Math.min(1, gain) * 100));
  }

  follow(player: Player) {
    const p = this.last;
    if (p?.mode !== "playing") return;
    const time = this.yt.getCurrentTime();
    if (this.seeking(time)) return;
    if (p.loopWraps && time >= p.loop.end) this.seekTo(p.loop.start);
    else if (Math.abs(time - player.position()) > DRIFT) player.correctPosition(time);
  }

  onStateChange(state: number, player: Player) {
    const playing = player.getState().playState === "playing";
    if (state === YT_PLAYING && !playing) {
      if (this.now() - this.pausedAt < SEEK_TIMEOUT) return this.yt.pauseVideo();
      player.dispatch({ type: "move", position: this.yt.getCurrentTime() });
      if (player.getState().playState !== "playing") player.dispatch({ type: "toggle-play" });
    } else if (state === YT_PAUSED && playing) {
      if (this.seeking(this.yt.getCurrentTime())) return this.yt.playVideo();
      player.dispatch({ type: "toggle-play" });
    }
  }

  private seekTo(position: RecordingSeconds) {
    this.seek = { position, at: this.now() };
    this.yt.seekTo(position, true);
  }

  private seeking(time: RecordingSeconds) {
    if (this.seek && Math.abs(time - this.seek.position) > DRIFT && this.now() - this.seek.at < SEEK_TIMEOUT) return true;
    this.seek = null;
    return false;
  }
}
