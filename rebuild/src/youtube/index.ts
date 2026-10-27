import { createBackend, describeError, loadApi } from "./backend";
import type { YouTube } from "./interfaces";
import { fromFile, isYouTube, lookupVideo, parseVideoId, toFile } from "./source";

export type * from "./interfaces";

export const youtube: YouTube = { loadApi, createBackend, describeError, isYouTube, parseVideoId, toFile, fromFile, lookupVideo };
