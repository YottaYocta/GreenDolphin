export const PROCESSOR_NAME = "gd-freeze";

export type FreezeMessage =
  | { type: "load"; channels: Float32Array[] }
  | { type: "seek"; position: number; jump: boolean }
  | { type: "active"; active: boolean };
