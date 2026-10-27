import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { capture } from "../analytics";
import { LibraryContext, type LibraryApi, type Opened } from "./context";
import { AudioEditor, YouTubeEditor } from "./Editor";
import { Library } from "./Library";
import { persistence, type StoredRecording } from "../persistence";
import { youtube } from "../youtube";

const DEMO = "Wynton Kelly - On Green Dolphin Street.mp3";

async function seedDemo() {
  if (persistence.flag("demo")) return;
  const res = await fetch(`/${encodeURIComponent(DEMO)}`).catch(() => null);
  if (!res?.ok) return;
  const blob = await res.blob();
  await persistence.putRecording(new File([blob], DEMO, { type: blob.type || "audio/mpeg" }));
  persistence.setFlag("demo", true);
}

export function App() {
  const ctx = useMemo(() => new AudioContext(), []);
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const openFile = useCallback(
    async (file: File) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const next: Opened = youtube.isYouTube(file)
          ? { name: file.name, size: file.size, kind: "youtube", source: await youtube.fromFile(file) }
          : { name: file.name, size: file.size, kind: "audio", buffer: await ctx.decodeAudioData(await file.arrayBuffer()) };
        if (id !== request.current) return;
        setOpened(next);
        persistence.setLastOpened(file.name);
      } catch {
        if (id === request.current) setError(`Couldn't open “${file.name}”. Is it an audio file?`);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [ctx],
  );

  useEffect(() => {
    (async () => {
      await seedDemo();
      const list = await persistence.listRecordings();
      setRecordings(list);
      const last = list.find((r) => r.file.name === persistence.lastOpened());
      if (last) await openFile(last.file);
      else setLoading(false);
    })().catch(() => setLoading(false));
    const resume = () => document.visibilityState === "visible" && ctx.state !== "running" && ctx.resume();
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [ctx, openFile]);

  const api = useMemo<LibraryApi>(() => {
    const refresh = async () => setRecordings(await persistence.listRecordings());
    return {
      recordings,
      opened,
      error,
      open: (name) => {
        const rec = recordings.find((r) => r.file.name === name);
        if (!rec) return;
        capture(opened ? "recording_switched" : "recording_played", { filename: name });
        void openFile(rec.file);
      },
      add: async (file) => {
        await persistence.putRecording(file);
        persistence.removeRecordingPrefs(file.name);
        await refresh();
        capture("file_uploaded", { filename: file.name, file_size: file.size, file_type: file.type });
        await openFile(file);
      },
      addYouTube: async (link) => {
        const videoId = youtube.parseVideoId(link);
        if (!videoId) throw new Error("Couldn't find a video in that link.");
        const found = await youtube.lookupVideo(videoId);
        if ("error" in found) throw new Error(found.error);
        const file = youtube.toFile({ videoId, url: link.trim(), title: found.title ?? `YouTube ${videoId}` });
        await persistence.putRecording(file);
        await refresh();
        capture("youtube_video_added", { video_id: videoId });
        await openFile(file);
      },
      remove: async (name) => {
        await persistence.deleteRecording(name);
        persistence.removeRecordingPrefs(name);
        await refresh();
        capture("recording_deleted", { filename: name });
      },
      home: () => {
        request.current++;
        setOpened(null);
        setLoading(false);
        persistence.setLastOpened(null);
      },
    };
  }, [recordings, opened, error, openFile]);

  return (
    <LibraryContext.Provider value={api}>
      {loading ? (
        <div className="w-screen h-dvh flex items-center justify-center">
          <SpinnerIcon size={32} className="animate-spin opacity-40" />
        </div>
      ) : opened?.kind === "audio" ? (
        <AudioEditor key={opened.name} name={opened.name} size={opened.size} buffer={opened.buffer} ctx={ctx} />
      ) : opened?.kind === "youtube" ? (
        <YouTubeEditor key={opened.name} name={opened.name} source={opened.source} />
      ) : (
        <Library />
      )}
    </LibraryContext.Provider>
  );
}
