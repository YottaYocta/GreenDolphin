import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import { computeMS } from "../lib/util";

export function useLoopPosition({
  sampleRate,
  loop,
  loopLength,
  playbackPosition,
  playState,
  timerStartedAtMS,
}: {
  sampleRate: number;
  loop: Section | undefined;
  loopLength: number;
  playbackPosition: RefObject<number>;
  playState: PlayState;
  timerStartedAtMS: number | null;
}): RefObject<number> {
  const loopPosition = useRef<number>(0);

  useEffect(() => {
    const loopStartMS = loop ? computeMS(sampleRate, loop.start) : 0;
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(update);
      if (playState === "waiting") {
        loopPosition.current =
          loopLength + (performance.now() - timerStartedAtMS!) / 1000;
      } else {
        loopPosition.current = (playbackPosition.current - loopStartMS) / 1000;
      }
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [sampleRate, loop, loopLength, playbackPosition, playState, timerStartedAtMS]);

  return loopPosition;
}
