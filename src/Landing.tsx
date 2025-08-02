import { LoadButton, Button } from "./components/buttons";

interface LandingProps {
  handleLoaded: (file: File) => void;
}

export function Landing({ handleLoaded }: LandingProps) {
  return (
    <div className="w-screen flex flex-col bg-white justify-center items-center gap-32">
      <div className="border-b border-neutral-2 w-full flex items-center justify-center">
        <nav className="w-2xl p-2 flex justify-between items-center rounded-xs gap-64">
          <h1 className=" text-emerald-600 font-semibold">GreenDolphin</h1>
          <div className="flex gap-8">
            <a
              href="#features-section"
              className="text-neutral-600 hover:text-emerald-600"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("features-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
            >
              Features
            </a>
            <a
              href="#report-bug-section"
              className="text-neutral-600 hover:text-emerald-600"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("report-bug-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
            >
              Report a Bug
            </a>
            <a
              href="#support-section"
              className="text-neutral-600 hover:text-emerald-600"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("support-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
            >
              Support
            </a>
          </div>
        </nav>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center gap-16">
        <div className="flex flex-col gap-8 items-center justify-center">
          <h1 className="text-3xl text-neutral-800 text-center max-w-2xl">
            Study Music Without Interruption
          </h1>
          <LoadButton
            handleLoaded={handleLoaded}
            buttonText="Load a Recording to Get Started"
          ></LoadButton>
        </div>
        <img
          src="/demoImage.png"
          alt="Demo"
          className="max-w-3xl h-auto mt-8 shadow-md"
        />
      </div>

      <hr className="w-96 stroke-neutral-2 border border-neutral-2" />

      <div
        id="features-section"
        className="flex-grow flex flex-col items-center justify-center gap-8"
      >
        <h2 className="text-2xl text-neutral-400 text-center max-w-2xl">
          What is GreenDolphin?
        </h2>
        <div className="flex flex-col items-center justify-center gap-1 text-neutral-600">
          <p>An open-source recording looper and analysis app,</p>
          <p>designed to help you replay and analyze recordings seamlessly</p>
        </div>

        <div className="flex justify-center items-center gap-16 mt-8">
          <div className="flex flex-col items-center gap-2 max-w-min">
            <img
              src="/controls.png"
              alt="Fine-grain playback playback control"
              className="min-w-72 h-48 object-contain border border-neutral-2 rounded-xs"
            />
            <p className="text-center text-neutral-600">
              Fine-grain playback control
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 max-w-min">
            <img
              src="/loopfreeze.png"
              alt="Freeze and automatically loop audio"
              className="min-w-72 h-48 object-contain border border-neutral-2 rounded-xs"
            />
            <p className="text-center text-neutral-600">
              Freeze and automatically loop audio
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 max-w-min">
            <img
              src="/frequencies.png"
              alt="Visualize frequencies in real time"
              className="min-w-72 h-48 object-contain border border-neutral-2 rounded-xs"
            />
            <p className="text-center text-neutral-600">
              Visualize frequencies in real time
            </p>
          </div>
        </div>
        <div className="flex justify-center items-center gap-16 mt-8">
          <div className="flex flex-col items-center gap-2 max-w-min">
            <img
              src="/filetype.png"
              alt="Supports audio and video files"
              className="min-w-72 h-48 object-contain border border-neutral-2 rounded-xs"
            />
            <p className="text-center text-neutral-600">
              Supports audio files and video files
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 max-w-min">
            <img
              src="/shortcuts.png"
              alt="Shortcuts for everything"
              className="min-w-72 h-48 object-contain border border-neutral-2 rounded-xs"
            />
            <p className="text-center text-neutral-600">
              Shortcuts for everything
            </p>
          </div>
        </div>
      </div>

      <hr className="w-96 stroke-neutral-2 border border-neutral-2" />

      <div
        id="report-bug-section"
        className="flex-grow flex flex-col items-center justify-center gap-8"
      >
        <h2 className="text-2xl text-neutral-400 text-center max-w-2xl">
          Encounter a Bug? Have Questions?
        </h2>
        <div className="flex items-center justify-center gap-2 text-neutral-600">
          <p>Please fill out</p>
          <Button
            className="border border-emerald-500 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            text="This Google Form"
            onClick={() =>
              window.open("https://forms.gle/XmVubjrPpvwwXJ7U7", "_blank")
            }
          />
        </div>
      </div>
      <hr className="w-96 stroke-neutral-2 border border-neutral-2" />

      <div
        id="support-section"
        className="flex-grow flex flex-col items-center justify-center gap-8"
      >
        <h2 className="text-2xl text-neutral-400 text-center max-w-2xl">
          Like What You See?
        </h2>
        <div className="flex items-center justify-center gap-2 text-neutral-600">
          <p>Consider sharing GreenDolphin with friends or</p>
          <Button
            className="border border-emerald-500 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            text="Starring the GitHub"
            onClick={() =>
              window.open(
                "https://github.com/YottaYocta/GreenDolphin",
                "_blank"
              )
            }
          />
        </div>
      </div>

      <div className="w-full flex items-center justify-center">
        <p className="text-neutral-400">
          Version 0.1, source code licensed under <em>GPL 3</em>
        </p>
      </div>
    </div>
  );
}
