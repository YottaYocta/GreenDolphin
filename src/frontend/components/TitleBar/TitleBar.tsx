import { RecordingsMenu } from "./RecordingsMenu";
import { FileInfoButton } from "./FileInfoButton";
import { HomeButton } from "./HomeButton";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] antialiased flex items-center justify-between gap-4 h-12 shrink-0">
      <div className="flex items-center min-w-0 flex-1">
        <RecordingsMenu />
        <FileInfoButton />
      </div>
      <HomeButton />
    </div>
  );
}
