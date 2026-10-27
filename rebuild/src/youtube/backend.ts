import type { Backend, Output, Player } from "../domain/player";

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
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

/** Drives an embedded YouTube player; the video is the clock, corrected through `follow`. */
export class YouTubeBackend implements Backend {
  readonly nativeLoop = false;
  private last: Output | null = null;
  private seek: { position: number; at: number } | null = null;
  private pausedAt = -Infinity;
  private readonly yt: YTPlayer;

  constructor(yt: YTPlayer) {
    this.yt = yt;
  }

  now = () => performance.now() / 1000;

  apply(o: Output) {
    const prev = this.last;
    this.last = o;
    if (!prev || prev.mode !== o.mode || prev.generation !== o.generation) {
      this.seek = { position: o.position, at: this.now() };
      this.yt.seekTo(o.position, true);
      if (o.mode === "play") this.yt.playVideo();
      else {
        this.pausedAt = this.now();
        this.yt.pauseVideo();
      }
    }
    this.yt.setPlaybackRate(o.speed);
    this.yt.setVolume(Math.round(Math.min(1, o.gain) * 100));
  }

  private seeking(time: number) {
    if (this.seek && Math.abs(time - this.seek.position) > DRIFT && this.now() - this.seek.at < SEEK_TIMEOUT) return true;
    this.seek = null;
    return false;
  }

  /** Call every frame: pulls the player's clock back to the video when they drift apart. */
  follow(player: Player) {
    if (player.getState().playState !== "playing") return;
    const time = this.yt.getCurrentTime();
    if (!this.seeking(time) && Math.abs(time - player.position()) > DRIFT) player.resync(time);
  }

  /** Mirrors play/pause made inside the embed; ignores transient states caused by our own commands. */
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
}
