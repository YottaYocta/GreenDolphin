import type { LinearGain } from "../audio";
import type { DurationSeconds, Output, Player, RecordingSeconds, SpeedRatio } from "../core";

export type YTPlayerState = number;
export type YTErrorCode = number;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(position: RecordingSeconds, allowSeekAhead: boolean): void;
  getCurrentTime(): RecordingSeconds;
  getDuration(): DurationSeconds;
  setPlaybackRate(rate: SpeedRatio): void;
  setVolume(volumePercent: number): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: (e: { target: YTPlayer }) => void;
    onStateChange: (e: { data: YTPlayerState }) => void;
    onError: (e: { data: YTErrorCode }) => void;
  };
}

export interface YTNamespace {
  Player: new (host: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeSource {
  videoId: string;
  title: string;
}

export type VideoLookup = { title: string | null } | { error: string };

export interface YouTubeBackend extends Output {
  setVolume(gain: LinearGain): void;
  follow(player: Player): void;
  onStateChange(state: YTPlayerState, player: Player): void;
}

export interface YouTube {
  loadApi(): Promise<YTNamespace>;
  createBackend(yt: YTPlayer): YouTubeBackend;
  describeError(code: YTErrorCode): string;
  isYouTube(file: File): boolean;
  parseVideoId(input: string): string | null;
  toFile(source: YouTubeSource): File;
  fromFile(file: File): Promise<YouTubeSource>;
  lookupVideo(videoId: string): Promise<VideoLookup>;
}
