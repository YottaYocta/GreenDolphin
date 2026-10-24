import { RecordingsMenu } from "./RecordingsMenu";
import { HomeButton } from "./HomeButton";

export function TitleBar() {
  return (
    <div className="[font-synthesis:none] antialiased flex items-center justify-between gap-4 h-12 shrink-0">
      <RecordingsMenu />
      <HomeButton />
    </div>
  );
}
