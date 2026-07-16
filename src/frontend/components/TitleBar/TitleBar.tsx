import { RecordingsMenu } from "./RecordingsMenu";
import { FileInfoButton } from "./FileInfoButton";
import { HomeButton } from "./HomeButton";
import { EditorSettings } from "./EditorSettings";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] grid grid-cols-4 antialiased gap-4">
      <div className="col-span-2 flex">
        <RecordingsMenu />

        <FileInfoButton />
      </div>
      <EditorSettings />
      <HomeButton />
    </div>
  );
}
