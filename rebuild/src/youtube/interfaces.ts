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

export type VideoLookup = { title: string | null } | { error: string };

export interface YouTubeOutput extends Output {
  readonly duration: DurationSeconds;
  setVolume(gain: LinearGain): void;
  follow(player: Player): () => void;
}

export interface YouTubeEmbed {
  ready: Promise<YouTubeOutput>;
  dispose(): void;
}

export interface YouTube {
  parseVideoId(input: string): string | null;
  lookupVideo(videoId: string): Promise<VideoLookup>;
  embed(host: HTMLElement, videoId: string, onError: (message: string) => void): YouTubeEmbed;
}
