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

export function displayName(file: File): string {
  return isYouTubeFile(file) ? stripYouTubeExt(file.name) : file.name;
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
    // not a URL
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

export async function fetchYouTubeTitle(
  videoId: string,
): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: unknown };
    return typeof json.title === "string" ? json.title : null;
  } catch {
    return null;
  }
}
