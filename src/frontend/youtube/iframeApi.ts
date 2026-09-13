export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  destroy(): void;
}

export const YT_STATE_PLAYING = 1;
export const YT_STATE_PAUSED = 2;

export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "That video link looks invalid.";
    case 100:
      return "This video was removed or is private.";
    case 101:
    case 150:
      return "The owner of this video doesn't allow it to be played outside YouTube.";
    default:
      return "This video couldn't be played.";
  }
}

export interface YouTubePlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YouTubePlayer }) => void;
    onStateChange?: (e: { target: YouTubePlayer; data: number }) => void;
    onError?: (e: { target: YouTubePlayer; data: number }) => void;
  };
}

interface YouTubeNamespace {
  Player: new (el: HTMLElement, opts: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}
