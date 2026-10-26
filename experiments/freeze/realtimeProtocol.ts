export const PROCESSOR_NAME = "gd-pv-freeze";

export interface RealtimeConfig {
  /** Single-resolution window, or the high band's window when multi-res. */
  n: number;
  phase: number;
  spreadMs: number;
  /** 0 = single resolution. */
  multires: number;
  low: number;
  fc: number;
}

export type ProcessorMessage =
  | { type: "load"; channels: Float32Array[] }
  | { type: "config"; config: RealtimeConfig }
  | { type: "seek"; position: number; jump?: boolean }
  | { type: "rate"; rate: number }
  | { type: "active"; active: boolean };
