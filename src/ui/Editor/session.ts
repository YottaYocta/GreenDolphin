import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DurationSeconds, LoopMode, Player, PlayerOptions, Section } from "../../core";
import type { AudioEngine } from "../../audio";
import type { YouTubeOutput } from "../../youtube";
import { FULL, clamp, fit, length, toFraction, toSection } from "./Timeline/geometry";
import { persistence, type LoopPrefs, type RecordingId } from "../../persistence";

export const usePlayer = (player: Player) => useSyncExternalStore(player.subscribe, player.getState);

export interface Sound {
  pitch: number;
  gain: number;
}

export type SoundOutput = AudioEngine | YouTubeOutput;

export const toLoopMode = (p: LoopPrefs, loopLength: DurationSeconds): LoopMode =>
  p.mode === "manual" ? { type: "manual" } : { type: "automatic", delay: p.delayMode === "fixed" ? p.delayValue : (p.delayValue / 100) * loopLength };

export const savedLoopMode = (loopLength: DurationSeconds) => toLoopMode(persistence.loopPrefs(), loopLength);

export function restore(id: RecordingId, duration: DurationSeconds) {
  const p = persistence.recordingPrefs(id);
  const full = { start: 0, end: duration };
  const view = p.view ? fit(p.view, full) : full;
  const loopFraction = p.loop ? toFraction(view, p.loop) : FULL;
  const loop = toSection(view, loopFraction);
  const options: PlayerOptions = {
    duration,
    position: clamp(p.position, 0, duration),
    loop,
    loopMode: savedLoopMode(length(loop)),
    speed: p.speed,
  };
  const sound: Sound = { pitch: p.pitch, gain: p.gain };
  return { view, loopFraction, options, sound };
}

export function useSound(id: RecordingId, initial: Sound, output: SoundOutput) {
  const [sound, setSound] = useState(initial);
  useEffect(() => {
    if ("setPitch" in output) output.setPitch(sound.pitch);
    output.setVolume(sound.gain);
    persistence.saveRecordingPrefs(id, sound);
  }, [id, output, sound]);
  return [sound, setSound] as const;
}

const POSITION_SAVE_MS = 1000;
const VIEW_SAVE_MS = 250;

export function usePersistence(id: RecordingId, player: Player) {
  const { speed, playState } = usePlayer(player);

  useEffect(() => persistence.saveRecordingPrefs(id, { speed }), [id, speed]);
  useEffect(() => {
    const save = () => persistence.saveRecordingPrefs(id, { position: player.position() });
    save();
    const interval = playState === "playing" ? setInterval(save, POSITION_SAVE_MS) : undefined;
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      save();
      clearInterval(interval);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [id, player, playState]);

  return useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      onView: (view: Section) => {
        clearTimeout(timer);
        timer = setTimeout(() => persistence.saveRecordingPrefs(id, { view }), VIEW_SAVE_MS);
      },
      onLoopCommit: (loop: Section) => persistence.saveRecordingPrefs(id, { loop }),
    };
  }, [id]);
}
