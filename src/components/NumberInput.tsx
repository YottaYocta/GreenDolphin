import { useState, useEffect, type FC, type ReactElement } from "react";
import { Button } from "./buttons";
import { MinusIcon, PlusIcon } from "lucide-react";

interface NumberInputProps {
  handleChange: (value: number) => void;
  value: number;
  icon: ReactElement;
  min?: number;
  max?: number;
  step?: number;
  for?: string;
  defaultValue?: number;
}

export const NumberInput: FC<NumberInputProps> = ({
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

  const updateValue = () => {
    const parsedValue = parseFloat(renderedValue);
    if (!Number.isNaN(parsedValue)) {
      const newValue = Math.min(
        max ?? Infinity,
        Math.max(min ?? -Infinity, parsedValue)
      );
      setRenderedValue(newValue.toString());
      handleChange(newValue);
    } else {
      setRenderedValue(defaultValue ? defaultValue.toString() : "0");
      handleChange(defaultValue ? defaultValue : 0);
    }
  };

  const handleIncrement = () => {
    const currentNumValue = parseFloat(renderedValue);
    const newValue = Math.min(
      max ?? Infinity,
      Math.max(min ?? -Infinity, currentNumValue + step)
    );
    setRenderedValue(newValue.toString());
    handleChange(newValue);
  };

  const handleDecrement = () => {
    const currentNumValue = parseFloat(renderedValue);
    const newValue = Math.max(
      min ?? -Infinity,
      Math.min(max ?? Infinity, currentNumValue - step)
    );
    setRenderedValue(newValue.toString());
    handleChange(newValue);
  };

  return (
    <div
      className={`flex border rounded-xs ${
        defaultValue !== undefined && value !== defaultValue
          ? "bg-emerald-50 border-emerald-500"
          : "bg-white border-neutral-2"
      }`}
    >
      <div
        className={`flex items-center h-full border-r p-2 ${
          defaultValue !== undefined && value !== defaultValue
            ? "border-emerald-500 text-emerald-700"
            : "border-neutral-2 text-emerald-600"
        }`}
      >
        {icon}
      </div>
      <div className="flex justify-center items-center px-2 gap-1">
        <Button
          ariaLabel={forLabel ? `decrements ${forLabel}` : "decrement value"}
          icon={<MinusIcon width={18} height={18}></MinusIcon>}
          onClick={handleDecrement}
        ></Button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={renderedValue}
          size={renderedValue.length - 2}
          className={`w-10 no-spinner text-center ${
            defaultValue !== undefined && value !== defaultValue
              ? "text-emerald-700 border-emerald-500"
              : "text-neutral-900 border-neutral-2"
          } border rounded-full`}
          onInput={(e) => {
            setRenderedValue(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateValue();
            }
          }}
          onBlur={updateValue}
        ></input>
        <Button
          ariaLabel={forLabel ? `increments ${forLabel}` : "increment value"}
          icon={<PlusIcon width={18} height={18}></PlusIcon>}
          onClick={handleIncrement}
        ></Button>
      </div>
    </div>
  );
};
