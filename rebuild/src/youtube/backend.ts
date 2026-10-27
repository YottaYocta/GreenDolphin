import { core, type ClockSeconds, type DurationSeconds, type Playback, type Player, type RecordingSeconds } from "../core";
import type { LinearGain } from "../audio";
import type { YouTube, YouTubeOutput, YTErrorCode, YTNamespace, YTPlayer, YTPlayerState } from "./interfaces";

let api: Promise<YTNamespace> | null = null;
const loadApi = () =>
  (api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    document.head.appendChild(Object.assign(document.createElement("script"), { src: "https://www.youtube.com/iframe_api" }));
  }));

const describeError = (code: YTErrorCode) => {
  if (code === 2) return "That video link looks invalid.";
  if (code === 100) return "This video was removed or is private.";
  if (code === 101 || code === 150) return "The owner of this video doesn't allow it to be played outside YouTube.";
  return "This video couldn't be played.";
};

const YT_PLAYING = 1;
const YT_PAUSED = 2;
const DRIFT = 0.4;
const SEEK_TIMEOUT = 3;

export const embed: YouTube["embed"] = (host, videoId, onError) => {
  const el = host.appendChild(document.createElement("div"));
  let yt: YTPlayer | null = null;
  let output: EmbedOutput | null = null;
  let disposed = false;
  const ready = new Promise<YouTubeOutput>((resolve) => {
    const start = () => yt && !output && yt.getDuration() > 0 && resolve((output = new EmbedOutput(yt)));
    void loadApi().then((YT) => {
      if (disposed) return;
      yt = new YT.Player(el, {
        videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: start,
          onStateChange: ({ data }) => (output ? output.stateChanged(data) : start()),
          onError: ({ data }) => onError(describeError(data)),
        },
      });
    });
  });
  return {
    ready,
    dispose() {
      disposed = true;
      el.remove();
      try {
        yt?.destroy();
      } catch {
        yt = null;
      }
    },
  };
};

class EmbedOutput implements YouTubeOutput {
  readonly duration: DurationSeconds;
  private player: Player | null = null;
  private last: Playback | null = null;
  private seek: { position: RecordingSeconds; at: ClockSeconds } | null = null;
  private pausedAt = -Infinity;
  private readonly yt: YTPlayer;

  constructor(yt: YTPlayer) {
    this.yt = yt;
    this.duration = yt.getDuration();
  }

  now = () => performance.now() / 1000;

  render(p: Playback) {
    const prev = this.last;
    this.last = p;
    const modeChanged = !prev || prev.mode !== p.mode;
    if (modeChanged || !core.continues(prev!, p)) {
      const target = core.positionAt(p, this.now());
      if (modeChanged || Math.abs(this.yt.getCurrentTime() - target) > DRIFT) this.seekTo(target);
      if (modeChanged && p.mode === "playing") this.yt.playVideo();
      else if (modeChanged) {
        this.pausedAt = this.now();
        this.yt.pauseVideo();
      }
    }
    this.yt.setPlaybackRate(p.rate);
  }

  setVolume(gain: LinearGain) {
    this.yt.setVolume(Math.round(Math.min(1, gain) * 100));
  }

  follow(player: Player) {
    this.player = player;
    let raf = 0;
    const tick = () => {
      this.sync(player);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      this.player = null;
    };
  }

  stateChanged(state: YTPlayerState) {
    const player = this.player;
    if (!player) return;
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

  private sync(player: Player) {
    const p = this.last;
    if (p?.mode !== "playing") return;
    const time = this.yt.getCurrentTime();
    if (this.seeking(time)) return;
    if (p.loopWraps && time >= p.loop.end) this.seekTo(p.loop.start);
    else if (Math.abs(time - player.position()) > DRIFT) player.correctPosition(time);
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
