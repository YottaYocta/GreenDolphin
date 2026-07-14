import type { WaveformData } from "../../lib/waveform";

export type WaveformMetadata = Required<
  Pick<WaveformData, "range" | "section">
>;
