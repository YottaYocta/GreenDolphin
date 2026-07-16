import { useEffect, type RefObject } from "react";
import { tinykeys } from "tinykeys";
import { MIN_RANGE_THRESHOLD } from "../../lib/constants";
import { clampSection } from "../../lib/util";
import type { Section } from "../../lib/waveform";
import type { WaveformMetadata } from "./types";

const STEP_FRACTION = 0.1;

export const useKeyboardShortcuts = (
  audioBuffer: AudioBuffer,
  metadataRef: RefObject<WaveformMetadata>,
  handleRange: (range: Section) => void,
) => {
  useEffect(() => {
    const minRange = Math.floor(MIN_RANGE_THRESHOLD * audioBuffer.length);
    const bounds: Section = { start: 0, end: audioBuffer.length };

    const apply = (mut: (viewport: Section, step: number) => Section) => {
      const { viewport } = metadataRef.current;
      const step = Math.floor((viewport.end - viewport.start) * STEP_FRACTION);
      handleRange(clampSection(mut(viewport, step), bounds));
    };

    const zoomIn = () =>
      apply((range, step) => {
        const mid = Math.floor(range.start + (range.end - range.start) / 2);
        const halfMin = Math.floor(minRange / 2);
        return {
          start: Math.min(mid - halfMin, range.start + step),
          end: Math.max(mid + halfMin, range.end - step),
        };
      });
    const zoomOut = () =>
      apply((range, step) => ({
        start: range.start - step,
        end: range.end + step,
      }));
    const scroll = (direction: -1 | 1) =>
      apply((range, step) => ({
        start: range.start + step * direction,
        end: range.end + step * direction,
      }));

    return tinykeys(window, {
      j: zoomOut,
      k: zoomIn,
      H: () => scroll(-1),
      L: () => scroll(1),
    });
  }, [audioBuffer, metadataRef, handleRange]);
};
