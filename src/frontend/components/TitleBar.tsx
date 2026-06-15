import { RecordingsMenu } from "./RecordingsMenu";
import { FileInfoButton } from "./FileInfoButton";
import { HomeButton } from "./HomeButton";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] grid grid-cols-[2fr_1fr_1fr] antialiased gap-4">
      <RecordingsMenu />
      <FileInfoButton />
      <HomeButton />
    </div>
  );
}
