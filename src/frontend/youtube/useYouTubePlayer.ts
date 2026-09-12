import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeIframeApi } from "./iframeApi";
import type { YouTubePlayer } from "./iframeApi";

export type PlayerStateListener = (state: number) => void;

export function useYouTubePlayer(videoId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listenerRef = useRef<PlayerStateListener | null>(null);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [duration, setDuration] = useState(0);

  const subscribe = useCallback((listener: PlayerStateListener) => {
    listenerRef.current = listener;
    return () => {
      if (listenerRef.current === listener) listenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: YouTubePlayer | null = null;
    const host = document.createElement("div");
    container.appendChild(host);

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled) {
        host.remove();
        return;
      }
      instance = new YT.Player(host, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: { disablekb: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setPlayer(e.target);
            setDuration(e.target.getDuration());
          },
          onStateChange: (e) => {
            if (cancelled) return;
            const d = e.target.getDuration();
            if (d > 0) setDuration(d);
            listenerRef.current?.(e.data);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      setPlayer(null);
      setDuration(0);
      try {
        instance?.destroy();
      } catch {
        // player already torn down
      }
      host.remove();
    };
  }, [videoId]);

  return { containerRef, player, duration, subscribe };
}
