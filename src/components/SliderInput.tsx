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
}) => {
  const [renderedValue, setRenderedValue] = useState(value.toString());

  useEffect(() => {
    setRenderedValue(value.toString());
  }, [value]);

  return (
    <div className={`flex rounded-xs bg-white h-10 gap-2 w-full`}>
      <div
        className={`flex items-center h-full border p-2 ${
          defaultValue !== undefined && value !== defaultValue
            ? "border-emerald-500 text-emerald-700 bg-emerald-50"
            : "border-neutral-2 text-neutral-600"
        } aspect-square justify-center`}
      >
        {icon}
      </div>
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
          value={renderedValue}
          className={`w-full h-1 bg-neutral-400 rounded-lg appearance-none cursor-pointer ${
            defaultValue !== undefined && value !== defaultValue
              ? "accent-emerald-500"
              : "accent-emerald-600"
          }`}
          onInput={(e) => {
            setRenderedValue(e.currentTarget.value);
            handleChange(parseFloat(e.currentTarget.value));
          }}
        ></input>
      </div>
    </div>
  );
};
