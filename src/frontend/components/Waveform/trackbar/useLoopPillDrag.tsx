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
    const { viewport, selection } = metadata.current;
    const rangeLen = viewport.end - viewport.start;
    const selectionLen = selection.end - selection.start;
    const initialStart = selection.start;
    let latest: Section = selection;
    beginDrag(
      (moveClientX) => {
        const dxSamples = Math.round(
          ((moveClientX - clientX) / rect.width) * rangeLen,
        );
        const nextStart = Math.max(
          0,
          Math.min(totalSamples - selectionLen, initialStart + dxSamples),
        );
        latest = { start: nextStart, end: nextStart + selectionLen };
        handleLoopEdit(latest);
      },
      () => handleLoopEditFinish(latest),
    );
  });
