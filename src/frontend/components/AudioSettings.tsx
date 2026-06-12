import {
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type RefObject,
} from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { useDrag } from "../lib/useDrag";
import { Menu } from "@base-ui/react/menu";
import { usePostHog } from "@posthog/react";

export function AudioSettings() {
  const posthog = usePostHog();
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("AudioSettings must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings, loopLength, loopPosition } =
    playback;
  const { pitchShift, playbackSpeed } = playbackSettings;

  const [renderedGain, setRenderedGain] = useState(1);
  useEffect(() => {
    setAudioSettings({ gain: renderedGain * renderedGain });
  }, [renderedGain, setAudioSettings]);

  const [delayRatio, setDelayRatio] = useState(0.5);
  useEffect(() => {
    if (!playbackSettings.loop) {
      setAudioSettings({ loopDelay: 0 });
      return;
    }
    setAudioSettings({
      loopDelay: (loopLength * (1 - delayRatio)) / delayRatio,
    });
  }, [playbackSettings.loop, delayRatio, loopLength, setAudioSettings]);

  const sliders = (
    <>
      <AudioSlider
        label="Pitch"
        value={pitchShift}
        min={-10}
        max={10}
        step={0.2}
        onChange={(v) => {
          const rounded = Math.round(v * 10) / 10;
          setAudioSettings({ pitchShift: rounded });
          posthog?.capture("pitch_changed", { pitch_semitones: rounded });
        }}
        formatValue={(v) => `${v >= 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
        unit="smt"
      />
      <AudioSlider
        label="Speed"
        value={playbackSpeed}
        min={0.1}
        max={1.9}
        step={0.1}
        onChange={(v) => {
          const rounded = Math.round(v * 10) / 10;
          setAudioSettings({ playbackSpeed: rounded });
          posthog?.capture("speed_changed", { speed_percent: Math.round(rounded * 100) });
        }}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
      />
      <AudioSlider
        label="Volume"
        value={renderedGain}
        min={0}
        max={2}
        step={0.1}
        onChange={(v) => setRenderedGain(Math.round(v * 10) / 10)}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
      />
    </>
  );

  return (
    <div className="flex flex-col items-end gap-3.25 flex-1 max-md:grow-0 w-full">
      <div className="w-full flex gap-4">
        <Menu.Root>
          <Menu.Trigger className="btn-surface rounded-lg gap-3 w-24 h-12 shrink-0 cursor-pointer max-md:flex hidden">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 256 256"
              style={{ opacity: 0.54, flexShrink: 0 }}
            >
              <path
                d="M84,136a28,28,0,0,1-20,26.83V216a8,8,0,0,1-16,0V162.83a28,28,0,0,1,0-53.66V40a8,8,0,0,1,16,0v69.17A28,28,0,0,1,84,136Zm52-74.83V40a8,8,0,0,0-16,0V61.17a28,28,0,0,0,0,53.66V216a8,8,0,0,0,16,0V114.83a28,28,0,0,0,0-53.66Zm72,80V40a8,8,0,0,0-16,0V141.17a28,28,0,0,0,0,53.66V216a8,8,0,0,0,16,0V194.83a28,28,0,0,0,0-53.66Z"
                fill="#000000"
              />
            </svg>
          </Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={8}>
              <Menu.Popup className="z-50 rounded-xl py-5 px-4 shrink-0 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A] w-min">
                <div className="flex flex-col justify-center self-stretch gap-2 w-[calc(100vw-4rem)] px-4">
                  {sliders}
                </div>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <LoopDelaySlider
          ratio={delayRatio}
          onChange={setDelayRatio}
          loopPosition={loopPosition}
          loopLength={loopLength}
          loopDelay={playbackSettings.loopDelay}
        />
      </div>
      <div className="flex flex-col justify-center self-stretch rounded-xl py-5 px-4 gap-4 shrink-0 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A] max-md:hidden">
        {sliders}
      </div>
    </div>
  );
}

const LoopDelaySlider: FC<{
  ratio: number;
  onChange: (ratio: number) => void;
  loopPosition: RefObject<number>;
  loopLength: number;
  loopDelay: number;
}> = ({ ratio, onChange, loopPosition, loopLength, loopDelay }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const updateRatio = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    onChange(
      Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width)),
    );
  };

  const [startDrag] = useDrag(({ clientX }) => updateRatio(clientX));

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const el = progressRef.current;
      if (!el) return;
      const excess = loopPosition.current - loopLength;
      const fraction =
        loopDelay > 0 ? Math.min(1, Math.max(0, excess / loopDelay)) : 0;
      el.style.width = `${fraction * 100}%`;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [loopPosition, loopLength, loopDelay]);

  return (
    <div className="flex grow items-center max-md:h-12 h-10 px-3 self-stretch rounded-xl gap-3 shrink-0 [box-shadow:#0000000D_0px_2px_3px] bg-white border border-[#0000001A]">
      <span className="shrink-0 font-inria text-black text-base/5 max-md:hidden">
        Loop Delay
      </span>
      <div
        ref={trackRef}
        className="relative flex-1 h-3 max-md:h-5 cursor-pointer"
        onMouseDown={(e) => {
          updateRatio(e.clientX);
          startDrag(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            updateRatio(e.touches[0].clientX);
            startDrag(e.touches[0].clientX);
          }
        }}
      >
        <div className="absolute inset-0 rounded-[3px] overflow-hidden bg-[#F5F5F5] border border-[#0000000D]">
          <div
            className="absolute inset-y-0 left-0 bg-[#ADADAD]"
            style={{ width: `${ratio * 100}%` }}
          />
          <div
            className="absolute inset-y-0 overflow-hidden"
            style={{ left: `${ratio * 100}%`, right: 0 }}
          >
            <div
              ref={progressRef}
              className="absolute inset-y-0 left-0 bg-emerald-400"
              style={{ width: "0%" }}
            />
          </div>
        </div>
        <div
          className="absolute top-1/2 z-10 w-6 h-5.5 max-md:h-7 rounded-[5px] -translate-x-1/2 -translate-y-1/2 [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A] pointer-events-none"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
};

const AudioSlider: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  unit: string;
}> = ({ label, value, min, max, step, onChange, formatValue, unit }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const setValue = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  };

  const [startDrag] = useDrag(({ clientX }) => setValue(clientX));

  const thumbPct = (value - min) / (max - min);

  return (
    <div className="flex items-center gap-2 self-stretch">
      <div className="w-15 shrink-0 font-inria text-black text-base/5">
        {label}
      </div>
      <div
        ref={trackRef}
        className="relative flex-1 h-5 rounded-[3px] bg-[#F5F5F5] border border-[#0000000D] cursor-pointer"
        onMouseDown={(e) => {
          setValue(e.clientX);
          startDrag(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            setValue(e.touches[0].clientX);
            startDrag(e.touches[0].clientX);
          }
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-6.5 rounded-xs [box-shadow:#FFFFFF_0px_0px_4px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-[#0000001A]"
          style={{ left: `calc(${thumbPct * 100}% - 5px)` }}
        />
      </div>
      <div className="flex items-center gap-3 w-17.5 shrink-0">
        <div className="flex items-center px-1 py-0.5 rounded-sm bg-[#E8E8E8]">
          <span className="font-space-mono text-black text-base/5 tabular-nums">
            {formatValue(value)}
          </span>
        </div>
        <span className="font-space-mono text-black text-base/5">{unit}</span>
      </div>
    </div>
  );
};
