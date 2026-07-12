import type { WaveformData } from "../../lib/waveform";

export type WaveformMetadata = Pick<WaveformData, "range" | "section">;
