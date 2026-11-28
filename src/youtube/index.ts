import { embed } from "./backend";
import type { YouTube } from "./interfaces";
import { lookupVideo, parseVideoId } from "./source";

export type { YouTube, YouTubeOutput } from "./interfaces";

export const youtube: YouTube = { parseVideoId, lookupVideo, embed };
