import { RecordingsMenu } from "./RecordingsMenu";
import { FileInfoButton } from "./FileInfoButton";
import { HomeButton } from "./HomeButton";
import { GearIcon } from "@phosphor-icons/react";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] grid grid-cols-4 antialiased gap-4">
      <div className="col-span-2 flex">
        <RecordingsMenu />

        <FileInfoButton />
      </div>
      <button className="btn-surface rounded-lg gap-2 px-3.25 py-3.25">
        <GearIcon
          size={16}
          weight="fill"
          color="var(--color-icon)"
          style={{ opacity: 0.5, flexShrink: 0 }}
        />

        <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden">
          Settings
        </span>
      </button>
      <HomeButton />
    </div>
  );
}
