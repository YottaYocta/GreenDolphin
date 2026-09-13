export const YOUTUBE_MIME = "application/x-greendolphin-youtube";
export const YOUTUBE_EXT = ".yt";

export interface YouTubeFileData {
  videoId: string;
  url: string;
  title: string;
}

export function isYouTubeFile(file: File): boolean {
  return file.type === YOUTUBE_MIME || file.name.endsWith(YOUTUBE_EXT);
}

export function stripYouTubeExt(filename: string): string {
  return filename.replace(/\.yt$/, "");
}

export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (match) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function makeYouTubeFile(data: YouTubeFileData): File {
  return new File([JSON.stringify(data)], `${data.title}${YOUTUBE_EXT}`, {
    type: YOUTUBE_MIME,
  });
}

export async function readYouTubeFile(file: File): Promise<YouTubeFileData> {
  return JSON.parse(await file.text()) as YouTubeFileData;
}

export type YouTubeLookup =
  | { status: "ok"; title: string | null }
  | { status: "not-embeddable" }
  | { status: "private" }
  | { status: "not-found" }
  | { status: "unknown" };

export async function lookupYouTubeVideo(
  videoId: string,
): Promise<YouTubeLookup> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    );
    if (res.ok) {
      const json = (await res.json()) as { title?: unknown };
      return {
        status: "ok",
        title: typeof json.title === "string" ? json.title : null,
      };
    }
    if (res.status === 401) return { status: "not-embeddable" };
    if (res.status === 403) return { status: "private" };
    if (res.status === 400 || res.status === 404)
      return { status: "not-found" };
    return { status: "unknown" };
  } catch {
    // Network failure or a blocking CSP — can't tell anything about the
    // video, so let the add proceed and rely on the player's onError.
    return { status: "unknown" };
  }
}
