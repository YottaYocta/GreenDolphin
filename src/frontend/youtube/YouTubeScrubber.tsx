import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Trackbar } from "../components/Waveform/trackbar";
import type { WaveformMetadata } from "../components/Waveform/types";
import type { Section } from "../lib/waveform";
import { clampSection } from "../lib/util";
import { YOUTUBE_SAMPLE_RATE } from "./YouTubePlaybackProvider";

export interface YouTubeScrubberProps {
  totalMS: number;
  positionMS: RefObject<number>;
  initialSelection?: Section;
  handleSelection: (selection: Section) => void;
  handlePosition: (positionMS: number) => void;
}

// The trackbar from the waveform view, pinned to a full-length viewport:
// just the green playhead and the loop range, no waveform underneath.
export const YouTubeScrubber = ({
  totalMS,
  positionMS,
  initialSelection,
  handleSelection,
  handlePosition,
}: YouTubeScrubberProps) => {
  const fullRange = { start: 0, end: totalMS };
  const metadataRef = useRef<WaveformMetadata>({
    viewport: fullRange,
    selection: initialSelection ?? fullRange,
  });

  useEffect(() => {
    const full = { start: 0, end: totalMS };
    metadataRef.current = {
      viewport: full,
      selection: clampSection(metadataRef.current.selection, full),
    };
  }, [totalMS]);

  return (
    <Trackbar
      positionMS={positionMS}
      metadata={metadataRef}
      sampleRate={YOUTUBE_SAMPLE_RATE}
      totalSamples={totalMS}
      handleLoopEdit={(selection) => {
        metadataRef.current = { ...metadataRef.current, selection };
      }}
      handleLoopEditFinish={(selection) => {
        metadataRef.current = { ...metadataRef.current, selection };
        handleSelection(selection);
      }}
      handlePosition={handlePosition}
      handleRange={(viewport) => {
        metadataRef.current = { ...metadataRef.current, viewport };
      }}
    />
  );
};
