import { useState, type FC, type ReactElement } from "react";
import { Button } from "./buttons";
import { MinusIcon, PlusIcon } from "lucide-react";

interface NumberInputProps {
  handleChange: (value: number) => void;
  icon: ReactElement;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  for?: string;
}

export const NumberInput: FC<NumberInputProps> = ({
  handleChange,
  icon,
  min,
  max,
  defaultValue = 1,
  step = 1,
  for: forLabel,
}) => {
  const [value, setValue] = useState(defaultValue);

  const handleIncrement = () => {
    setValue((prevValue) => {
      const newValue = Math.min(
        max ?? Infinity,
        Math.max(min ?? -Infinity, prevValue + step)
      );
      handleChange(newValue);
      return newValue;
    });
  };

  const handleDecrement = () => {
    setValue((prevValue) => {
      const newValue = Math.max(
        min ?? -Infinity,
        Math.min(max ?? Infinity, prevValue - step)
      );
      handleChange(newValue);
      return newValue;
    });
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
          value={value}
          size={value.toString().length}
          className="no-spinner text-center"
          onInput={(e) => {
            const newValue = Math.min(
              max ?? Infinity,
              Math.max(min ?? -Infinity, e.currentTarget.valueAsNumber)
            );

            setValue(() => {
              if (Number.isNaN(newValue)) {
                handleChange(0);
                return 0;
              } else {
                handleChange(newValue);
                return newValue;
              }
            });
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
