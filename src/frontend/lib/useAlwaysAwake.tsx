import { useCallback, useEffect, useRef, useState } from "react";

function createBlankVideoUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("no 2d context"));
    ctx.fillRect(0, 0, 1, 1);

    const stream = canvas.captureStream(1);
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      resolve(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 200);
  });
}

export function useAlwaysAwake() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playingRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = document.createElement("video");
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    videoRef.current = video;

    let blobUrl: string;
    createBlankVideoUrl().then((url) => {
      blobUrl = url;
      video.src = url;
    }).catch(() => {});

    return () => {
      video.pause();
      video.remove();
      videoRef.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  const activate = useCallback(() => {
    if (playingRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    playingRef.current = true;
    video.play()
      .then(() => setReady(true))
      .catch(() => { playingRef.current = false; });
  }, []);

  return { activate, ready };
}
