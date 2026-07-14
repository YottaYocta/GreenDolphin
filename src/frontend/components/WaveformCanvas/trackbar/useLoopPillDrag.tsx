import { type RefObject } from "react";
import type { Section } from "../../../lib/waveform";
import type { WaveformMetadata } from "../types";
import { beginDrag, dragHandlers } from "./dragUtils";

export const useLoopPillDrag = (
  trackRef: RefObject<HTMLDivElement | null>,
  metadata: RefObject<WaveformMetadata>,
  totalSamples: number,
  handleLoopEdit: (section: Section) => void,
  handleLoopEditFinish: (section: Section) => void,
) =>
  dragHandlers((clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const { range, section } = metadata.current;
    const rangeLen = range.end - range.start;
    const sectionLen = section.end - section.start;
    const initialStart = section.start;
    let latest: Section = section;
    beginDrag(
      (moveClientX) => {
        const dxSamples = Math.round(
          ((moveClientX - clientX) / rect.width) * rangeLen,
        );
        const nextStart = Math.max(
          0,
          Math.min(totalSamples - sectionLen, initialStart + dxSamples),
        );
        latest = { start: nextStart, end: nextStart + sectionLen };
        handleLoopEdit(latest);
      },
      () => handleLoopEditFinish(latest),
    );
  });
