import { RotateCcwIcon } from "lucide-react";
import { useState, useEffect, type FC, type ReactElement } from "react";

interface SliderInputProps {
  handleChange: (value: number) => void;
  value: number;
  icon: ReactElement;
  min?: number;
  max?: number;
  step?: number;
  for: string;
  defaultValue?: number;
  valueRenderer: (currentValue: number) => string;
}

export const SliderInput: FC<SliderInputProps> = ({
  handleChange,
  icon,
  min,
  max,
  value,
  step = 1,
  for: forLabel,
  defaultValue,
  valueRenderer,
}) => {
  const [renderedValue, setRenderedValue] = useState(valueRenderer(value));
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setRenderedValue(valueRenderer(value));
  }, [value, valueRenderer]);

  const handleResetClick = () => {
    if (defaultValue !== undefined) {
      setRenderedValue(valueRenderer(defaultValue));
      handleChange(defaultValue);
    }
  };

  return (
    <div className={`flex rounded-xs bg-white h-10 gap-2 w-full`}>
      <button
        className={`flex items-center h-full border p-2 rounded-full ${
          defaultValue !== undefined && value !== defaultValue
            ? "border-emerald-500 text-emerald-700 bg-emerald-50"
            : "border-neutral-2 text-neutral-600"
        } aspect-square justify-center`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleResetClick}
        title={`Reset ${forLabel}`}
        disabled={defaultValue === undefined}
        id={`reset-${forLabel.toLowerCase()}`}
      >
        {isHovering && defaultValue !== undefined ? (
          <RotateCcwIcon
            strokeWidth={1.5}
            className={`${
              defaultValue !== value ? "opacity-100" : "opacity-40"
            }`}
          />
        ) : (
          icon
        )}
      </button>
      <div className="flex flex-col justify-between items-center px-2 pb-2 gap-1 w-full">
        <div className=" flex w-full justify-between h-min">
          <p className="text-neutral-500 text-sm">{forLabel}</p>
          <p className="text-neutral-500 text-sm">{renderedValue}</p>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          className={`w-full h-1 bg-neutral-400 rounded-lg appearance-none cursor-pointer ${
            defaultValue !== undefined && value !== defaultValue
              ? "accent-emerald-500"
              : "accent-emerald-600"
          }`}
          onInput={(e) => {
            setRenderedValue(valueRenderer(parseFloat(e.currentTarget.value)));
            handleChange(parseFloat(e.currentTarget.value));
          }}
        ></input>
      </div>
    </div>
  );
};
