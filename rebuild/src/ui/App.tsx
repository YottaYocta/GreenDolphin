import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { capture } from "../analytics";
import { LibraryContext, type LibraryApi, type Opened } from "./context";
import { AudioEditor, YouTubeEditor } from "./Editor";
import { Library } from "./Library";
import { audio } from "../audio";
import { persistence, type StoredRecording } from "../persistence";
import { youtube } from "../youtube";

const DEMO = "Wynton Kelly - On Green Dolphin Street.mp3";

async function seedDemo() {
  if (persistence.flag("demo")) return;
  const res = await fetch(`/${encodeURIComponent(DEMO)}`).catch(() => null);
  if (!res?.ok) return;
  await persistence.addAudio(DEMO, await res.arrayBuffer());
  persistence.setFlag("demo", true);
}

export function App() {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const openRecording = useCallback(async ({ name, source }: StoredRecording) => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next: Opened =
        source.kind === "youtube"
          ? { name, kind: "youtube", videoId: source.videoId }
          : { name, kind: "audio", size: source.size, recording: await audio.decode(await persistence.readAudio(name)) };
      if (id !== request.current) return;
      setOpened(next);
      persistence.setLastOpened(name);
    } catch {
      if (id === request.current) setError(`Couldn't open “${name}”. Is it an audio file?`);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await seedDemo();
      const list = await persistence.listRecordings();
      setRecordings(list);
      const last = list.find((r) => r.name === persistence.lastOpened());
      if (last) await openRecording(last);
      else setLoading(false);
    })().catch(() => setLoading(false));
  }, [openRecording]);

  const api = useMemo<LibraryApi>(() => {
    const refresh = async (name: string) => {
      const list = await persistence.listRecordings();
      setRecordings(list);
      return list.find((r) => r.name === name);
    };
    return {
      recordings,
      opened,
      error,
      open: (name) => {
        const rec = recordings.find((r) => r.name === name);
        if (!rec) return;
        capture(opened ? "recording_switched" : "recording_played", { filename: name });
        void openRecording(rec);
      },
      add: async (file) => {
        await persistence.addAudio(file.name, await file.arrayBuffer());
        persistence.removeRecordingPrefs(file.name);
        const added = await refresh(file.name);
        capture("file_uploaded", { filename: file.name, file_size: file.size, file_type: file.type });
        if (added) await openRecording(added);
      },
      addYouTube: async (link) => {
        const videoId = youtube.parseVideoId(link);
        if (!videoId) throw new Error("Couldn't find a video in that link.");
        const found = await youtube.lookupVideo(videoId);
        if ("error" in found) throw new Error(found.error);
        const name = found.title ?? `YouTube ${videoId}`;
        await persistence.addYouTube(name, videoId);
        const added = await refresh(name);
        capture("youtube_video_added", { video_id: videoId });
        if (added) await openRecording(added);
      },
      remove: async (name) => {
        await persistence.deleteRecording(name);
        persistence.removeRecordingPrefs(name);
        await refresh(name);
        capture("recording_deleted", { filename: name });
      },
      home: () => {
        request.current++;
        setOpened(null);
        setLoading(false);
        persistence.setLastOpened(null);
      },
    };
  }, [recordings, opened, error, openRecording]);

  return (
    <LibraryContext.Provider value={api}>
      {loading ? (
        <div className="w-screen h-dvh flex items-center justify-center">
          <SpinnerIcon size={32} className="animate-spin opacity-40" />
        </div>
      ) : opened?.kind === "audio" ? (
        <AudioEditor key={opened.name} name={opened.name} size={opened.size} recording={opened.recording} />
      ) : opened?.kind === "youtube" ? (
        <YouTubeEditor key={opened.name} name={opened.name} videoId={opened.videoId} />
      ) : (
        <Library />
      )}
    </LibraryContext.Provider>
  );
}
