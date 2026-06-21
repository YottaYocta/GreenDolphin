import { MusicNoteIcon } from "@phosphor-icons/react";
import { noteColor } from "../lib/util";

export function NoteIcon({
  filename,
  size = 32,
}: {
  filename: string;
  size?: number;
}) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 aspect-square rounded-full w-14 bg-white shadow-(--shadow-drop) border border-border`}
    >
      <MusicNoteIcon
        size={size}
        weight="fill"
        color={noteColor(filename)}
        style={{ flexShrink: 0 }}
      />
    </div>
  );
}
