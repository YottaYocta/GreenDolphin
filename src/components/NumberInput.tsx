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
}

export const NumberInput: FC<NumberInputProps> = ({
  handleChange,
  icon,
  min,
  max,
  value,
  step = 1,
  for: forLabel,
}) => {
  const [renderedValue, setRenderedValue] = useState(value);

  useEffect(() => {
    setRenderedValue(value);
  }, [value]);

  const handleIncrement = () => {
    const newValue = Math.min(
      max ?? Infinity,
      Math.max(min ?? -Infinity, renderedValue + step)
    );
    setRenderedValue(newValue);
    handleChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(
      min ?? -Infinity,
      Math.min(max ?? Infinity, renderedValue - step)
    );
    setRenderedValue(newValue);
    handleChange(newValue);
  };

  return (
    <div className="flex border border-neutral-300 rounded-xs">
      <div className="flex items-center h-full border-r border-neutral-300 p-2">
        {icon}
      </div>
      <div className="flex justify-center items-center gap-2 px-2">
        <Button
          ariaLabel={forLabel ? `decrements ${forLabel}` : "decrement value"}
          icon={
            <MinusIcon
              strokeWidth={1.5}
              width={18}
              height={18}
              className="stroke-neutral-500"
            ></MinusIcon>
          }
          onClick={handleDecrement}
        ></Button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={
            renderedValue === value ? renderedValue.toFixed(2) : renderedValue
          }
          size={
            (renderedValue === value
              ? renderedValue.toFixed(2)
              : renderedValue
            ).toString().length
          }
          className="no-spinner text-center"
          onInput={(e) => {
            setRenderedValue(e.currentTarget.valueAsNumber);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const inputValue = e.currentTarget.valueAsNumber;
              const newValue = Math.min(
                max ?? Infinity,
                Math.max(min ?? -Infinity, inputValue)
              );
              if (Number.isNaN(newValue)) {
                setRenderedValue(0);
                handleChange(0);
              } else {
                setRenderedValue(newValue);
                handleChange(newValue);
              }
            }
          }}
        ></input>
        <Button
          ariaLabel={forLabel ? `increments ${forLabel}` : "increment value"}
          icon={
            <PlusIcon
              strokeWidth={1.5}
              width={18}
              height={18}
              className="stroke-neutral-500"
            ></PlusIcon>
          }
          onClick={handleIncrement}
        ></Button>
      </div>
    </div>
  );
};
