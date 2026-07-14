import { useEffect, useRef } from "react";
import { loadSession } from "../../lib/useSessionPersistence";
import type { Section } from "../../lib/waveform";

export const useSessionRestore = (
  filename: string | undefined,
  handleRange: (range: Section) => void,
) => {
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const session = loadSession();
    if (!session) return;
    if (session.filename === filename && session.waveformRange) {
      handleRange(session.waveformRange);
    }
  }, [filename, handleRange]);
};
