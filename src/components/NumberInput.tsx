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

  const updateValue = (
    e:
      | React.KeyboardEvent<HTMLInputElement>
      | React.FocusEvent<HTMLInputElement>
  ) => {
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
  };

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
          value={
            renderedValue === value ? renderedValue.toFixed(2) : renderedValue
          }
          size={
            (renderedValue === value
              ? renderedValue.toFixed(2)
              : renderedValue
            ).toString().length - 2
          }
          className="no-spinner text-center"
          onInput={(e) => {
            setRenderedValue(
              Number.isNaN(e.currentTarget.valueAsNumber)
                ? 0
                : e.currentTarget.valueAsNumber
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateValue(e);
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
