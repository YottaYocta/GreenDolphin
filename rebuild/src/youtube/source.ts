export const YOUTUBE_EXT = ".yt";
const MIME = "application/x-greendolphin-youtube";
const ID = /^[\w-]{11}$/;

export interface YouTubeSource {
  videoId: string;
  url: string;
  title: string;
}

export const isYouTube = (file: File) => file.type === MIME || file.name.endsWith(YOUTUBE_EXT);

export function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (ID.test(text)) return text;
  try {
    const url = new URL(/^[a-z][\w+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1).split("/")[0]
        : host === "youtube.com" || host.endsWith(".youtube.com")
          ? (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1])
          : null;
    return id && ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const toFile = (source: YouTubeSource) =>
  new File([JSON.stringify(source)], `${source.title}${YOUTUBE_EXT}`, { type: MIME });

export const fromFile = async (file: File) => JSON.parse(await file.text()) as YouTubeSource;

/** Title from oEmbed, or a reason the video can't be embedded. Network failures don't block adding. */
export async function lookupVideo(videoId: string): Promise<{ title: string | null } | { error: string }> {
  try {
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`);
    if (res.ok) {
      const { title } = (await res.json()) as { title?: unknown };
      return { title: typeof title === "string" ? title : null };
    }
    if (res.status === 401) return { error: "The owner of this video doesn't allow it to be played outside YouTube." };
    if (res.status === 403) return { error: "This video is private." };
    if (res.status === 400 || res.status === 404) return { error: "Couldn't find a video at that link." };
  } catch {
    /* lookup unavailable; the player reports problems later */
  }
  return { title: null };
}
