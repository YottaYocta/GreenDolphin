import { RecordingsMenu } from "./RecordingsMenu";
import { FileInfoButton } from "./FileInfoButton";
import { HomeButton } from "./HomeButton";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] grid grid-cols-4 antialiased gap-4">
      <div className="col-span-2">
        <RecordingsMenu />
      </div>
      <FileInfoButton />
      <HomeButton />
    </div>
  );
}
