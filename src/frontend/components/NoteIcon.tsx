import { MusicNoteIcon } from "@phosphor-icons/react";
import { noteColor } from "../lib/util";

export function NoteIcon({ filename, size = 32 }: { filename: string; size?: number }) {
  return (
    <MusicNoteIcon size={size} weight="fill" color={noteColor(filename)} style={{ flexShrink: 0 }} />
  );
}
