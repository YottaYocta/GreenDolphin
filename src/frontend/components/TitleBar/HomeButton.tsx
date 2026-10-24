import { useContext } from "react";
import { HouseIcon } from "@phosphor-icons/react";
import { AudioStore } from "../../AudioStore";
import { clearSession } from "../../lib/useSessionPersistence";

export function HomeButton() {
  const { setAudio } = useContext(AudioStore);

  return (
    <button
      onClick={() => {
        clearSession();
        setAudio(null);
      }}
      className="flex items-center justify-center gap-2 h-12 p-3.25 rounded-lg shrink-0 cursor-pointer hover:bg-black/5 active:bg-black/10 transition-colors"
    >
      <HouseIcon
        size={16}
        weight="fill"
        color="var(--color-icon)"
        style={{ opacity: 0.5, flexShrink: 0 }}
      />
      <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden">
        Home
      </span>
    </button>
  );
}
