import { AudioLinesIcon, MenuIcon } from "lucide-react";
import { Button, LoadButton } from "./components/buttons";
import { useMemo, useState } from "react";

interface LandingProps {
  handleLoaded: (file: File) => void;
}

export function Landing({ handleLoaded }: LandingProps) {
  const [showMenu, setShowMenu] = useState(false);

  const navItems = useMemo(() => {
    return [
      <a
        href="#features-section"
        className="text-neutral-600 hover:text-emerald-600 text-nowrap"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("features-section")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
      >
        Features
      </a>,
      <a
        href="#faq-section"
        className="text-neutral-600 hover:text-emerald-600 text-nowrap"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("features-section")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
      >
        FAQs
      </a>,
      <a
        href="#report-bug-section"
        className="text-neutral-600 hover:text-emerald-600 text-nowrap"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("report-bug-section")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }}
      >
        Report a Bug
      </a>,
      <a
        href="#support-section"
        className="text-neutral-600 hover:text-emerald-600 text-nowrap"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("support-section")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }}
      >
        Support
      </a>,
    ];
  }, []);

  return (
    <div
      className="w-full min-h-screen flex flex-col"
      onClick={() => setShowMenu(false)}
    >
      <div className="w-full flex items-center justify-center border-b border-neutral-2 p-2 sticky top-0 from-white to-white/50 backdrop-blur-sm bg-gradient-to-b">
        <nav className="flex items-center justify-between max-w-2xl w-full pl-2">
          <a href="#" className="text-emerald-600 font-semibold">
            GreenDolphin
          </a>
          <div className="sm:flex flex-row hidden gap-8">{...navItems}</div>
          <div className="relative sm:hidden">
            <Button
              icon={<MenuIcon></MenuIcon>}
              onClick={(e) => {
                setShowMenu(!showMenu);
                e.stopPropagation();
              }}
            ></Button>
            {showMenu && (
              <div className="absolute top-full right-0 bg-white rounded-sm flex flex-col gap-2 items-end p-2 border border-neutral-2">
                {...navItems}
              </div>
            )}
          </div>
        </nav>
      </div>
      <main className="p-8 flex flex-col gap-20 sm:items-center">
        <div className="flex flex-col gap-16 max-w-2xl">
          <div className="flex flex-col gap-8 sm:items-center">
            <h1 className="text-3xl mt-8">Study Music Without Interruption</h1>
            <div className="flex md:flex-row flex-col items-start md:items-center justify-center gap-2">
              <LoadButton
                handleLoaded={handleLoaded}
                text="Load recording"
              ></LoadButton>
              <Button
                className="positive-button"
                text="Try it out with a demo track"
                icon={
                  <AudioLinesIcon
                    width={18}
                    height={18}
                    strokeWidth={1.5}
                    className="text-emerald-700"
                  ></AudioLinesIcon>
                }
                onClick={async () => {
                  const res = await fetch(
                    "Wynton Kelly - On Green Dolphin Street [EXCERPT].mp3"
                  );
                  const blob = await res.blob();
                  const file = new File(
                    [blob],
                    "Wynton Kelly - On Green Dolphin Street [EXCERPT].mp3",
                    { type: "audio/mp3" }
                  );
                  handleLoaded(file);
                }}
              ></Button>
            </div>
          </div>
          <img
            src="./demoImage.png"
            alt="Demo"
            className="max-w-3xl w-full h-auto shadow-md"
          />
        </div>
        <div
          id="features-section"
          className="flex-grow flex flex-col justify-center gap-8 max-w-2xl"
        >
          <h2 className="text-lg text-neutral-400 max-w-2xl w-full border-b border-neutral-2">
            What is GreenDolphin?
          </h2>
          <div className="flex flex-col items-center justify-center gap-4 text-neutral-600">
            <p>
              GreenDolphin is an open-source recording looper and analysis tool,
              built for musicians who want to transcribe music or learn songs by
              ear.
            </p>
            <p>
              Unlike a conventional music player, GreenDolphin specializes in
              looping small sections of a recording. With GreenDolphin, you can:
            </p>
          </div>

          <div className="flex flex-row flex-wrap justify-center items-start gap-8 sm:gap-16 pt-8">
            <div className="flex flex-col items-center gap-2 max-w-min">
              <img
                src="./controls.png"
                alt="Fine-grain playback playback control"
                className="sm:min-w-56 min-w-32 h-36 object-contain border border-neutral-2 rounded-xs bg-white"
              />
              <p className="text-center text-neutral-400 text-sm">
                Adjust playback properties like speed and pitch
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 max-w-min">
              <img
                src="./loopfreeze.png"
                alt="Freeze and loop audio"
                className="sm:min-w-56 min-w-32 h-36 object-contain border border-neutral-2 rounded-xs bg-white"
              />
              <p className="text-center text-neutral-400 text-sm">
                Freeze and loop audio
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 max-w-min">
              <img
                src="./frequencies.png"
                alt="Visualize frequencies in real time"
                className="sm:min-w-56 min-w-32 h-36 object-contain border border-neutral-2 rounded-xs bg-white"
              />
              <p className="text-center text-neutral-400 text-sm">
                Visualize frequencies in real time
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 max-w-min">
              <img
                src="./filetype.png"
                alt="Load audio and video files"
                className="sm:min-w-56 min-w-32 h-36 object-contain border border-neutral-2 rounded-xs bg-white"
              />
              <p className="text-center text-neutral-400 text-sm">
                Load audio and video files
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 max-w-min">
              <img
                src="./shortcuts.png"
                alt="Shortcuts for everything"
                className="sm:min-w-56 min-w-32 h-36 object-contain border border-neutral-2 rounded-xs bg-white"
              />
              <p className="text-center text-neutral-400 text-sm">
                Use shortcuts for everything
              </p>
            </div>
          </div>
        </div>

        <section
          className="flex flex-wrap items-start w-full max-w-2xl justify-between gap-8"
          id="faq-section"
        >
          <h2 className="text-lg text-neutral-400  max-w-2xl w-full border-b border-neutral-2">
            FAQs
          </h2>

          <div className="flex flex-col w-full gap-2">
            <h3 className="text-neutral-600">
              Does GreenDolphin convert recordings to sheet music automatically?
            </h3>
            <span className="text-neutral-400 flex flex-col gap-2">
              <p>No, GreenDolphin is a tool to help you do that yourself :)</p>
              <p>
                Learning music by ear is an invaluable skill for any musician,
                and automatic transcription (while convenient) takes away the
                practice you get from closely studying a recording.
              </p>
            </span>
          </div>
          <div className="flex flex-col w-full gap-2">
            <h3 className="text-neutral-600">
              How does the frequency visualization work?
            </h3>
            <span className="text-neutral-400 flex flex-col gap-2">
              <p>
                The frequency visualization uses Fast Fourier Transform (FFT) to
                estimate which 'notes' are being played at any given time.
                Likely pitches are the highest peaks above the piano.
              </p>
              <p>
                Freezing the playback may be helpful in seeing the notes of a
                chord
              </p>
            </span>
          </div>
        </section>

        <section
          id="report-bug-section"
          className="w-full max-w-2xl flex flex-col justify-between gap-8"
        >
          <h2 className="text-lg text-neutral-400  max-w-2xl w-full border-b border-neutral-2">
            Encounter a Bug? Have Feedback?
          </h2>
          <div className="flex flex-wrap gap-2 text-neutral-600 items-center">
            <p>Please fill out</p>
            <Button
              className="border border-emerald-500 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              text="This Google Form"
              onClick={() =>
                window.open("https://forms.gle/XmVubjrPpvwwXJ7U7", "_blank")
              }
            />
            <p>or contact me</p>
            <a href="mailto:rwq3@cornell.edu">
              <Button
                className="border border-emerald-500 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                text="Via Email"
              />
            </a>
          </div>
        </section>

        <section
          id="support-section"
          className="w-full max-w-2xl gap-8 flex flex-col justify-between"
        >
          <h2 className="text-lg text-neutral-400 max-w-2xl w-full border-b border-neutral-2">
            Like What You See?
          </h2>
          <div className="flex flex-wrap gap-1 text-neutral-600 items-center gap-y-2">
            <p>Consider sharing GreenDolphin</p>
            <span className="flex items-center gap-2">
              with friends or
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
            </span>
          </div>
        </section>
        <div className="w-full flex items-center justify-center">
          <p className="text-neutral-400">
            Source code licensed under <em>GPL 3</em>
          </p>
        </div>
      </main>
    </div>
  );
}
