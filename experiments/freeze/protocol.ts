import type { SpectrumComparison } from "../dsp/spectrum";
import type { Params } from "./algorithms";

/** Span around the cursor the freeze is compared against. */
export const MOMENT_SECONDS = 0.3;

export interface FreezeRequest {
  id: string;
  at: number;
  params: Params;
}

export type WorkerMessage =
  | { type: "load"; channels: Float32Array[]; sampleRate: number }
  | { type: "render"; seq: number; req: FreezeRequest };

export interface WorkerResult {
  seq: number;
  algo: string;
  channels: Float32Array[];
  sampleRate: number;
  ms: number;
  bands: number[];
  source: number[];
  comparison: SpectrumComparison;
}
