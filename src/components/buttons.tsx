import { PlusIcon } from "lucide-react";
import { useRef, type FC, type ReactNode } from "react";

export interface LoadButtonProps {
  handleLoaded: (file: File) => void;
}

export interface ButtonProps {
  icon?: ReactNode;
  text?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  iconPlacement?: "left" | "right";
}

export const Button: FC<ButtonProps> = ({
  icon,
  text,
  onClick,
  className,
  ariaLabel,
  iconPlacement = "left", // Default to left
}) => {
  return (
    <button
      aria-label={ariaLabel}
      className={`hover:bg-neutral-100 p-1 rounded-full h-min w-min flex items-center justify-center text-center gap-1 flex-nowrap text-nowrap cursor-pointer ${className}`}
      onClick={onClick}
    >
      {iconPlacement === "left" && (
        <span className="text-neutral-500 text-center flex items-center justify-center w-min">
          {icon}
        </span>
      )}
      {text && <span className="text-neutral-800 text-center">{text}</span>}
      {iconPlacement === "right" && (
        <span className="text-neutral-500 text-center flex items-center justify-center w-min">
          {icon}
        </span>
      )}
    </button>
  );
};

export interface ToggleButtonProps {
  pressed: boolean;
  icon?: ReactNode;
  text?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  accent?: "positive" | "primary" | "negative";
  iconPlacement?: "left" | "right";
}

export const ToggleButton: FC<ToggleButtonProps> = ({
  pressed,
  icon,
  text,
  onClick,
  className,
  ariaLabel,
  accent,
  iconPlacement = "left",
}) => {
  return (
    <button
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={`${
        pressed
          ? accent === "positive"
            ? `hover:bg-emerald-100 bg-emerald-50 border-emerald-500`
            : accent === "negative"
            ? `hover:bg-rose-100 bg-rose-50 border-rose-400 text-rose-700`
            : `hover:bg-blue-100 bg-blue-100 border-blue-400 text-blue-600`
          : accent === "positive"
          ? "hover:bg-neutral-100 border-neutral-300 text-emerald-600 bg-white"
          : accent === "negative"
          ? "hover:bg-neutral-100 border-neutral-300 text-rose-500 bg-white"
          : "hover:bg-neutral-100 border-neutral-300 text-blue-500 bg-white"
      } p-2 rounded-full border h-min w-min flex-nowrap text-nowrap cursor-pointer ${className}`}
      onClick={onClick}
    >
      {iconPlacement === "left" && icon}
      {text}
      {iconPlacement === "right" && icon}
    </button>
  );
};

export const LoadButton: FC<LoadButtonProps> = ({ handleLoaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        className="border-neutral-300 border pl-2 pr-3"
        text="Load Recording"
        icon={<PlusIcon width={18} height={18} strokeWidth={1.5}></PlusIcon>}
        onClick={() => {
          if (inputRef.current) inputRef.current.click();
        }}
      ></Button>
      <input
        type="file"
        ref={inputRef}
        onChange={() => {
          if (
            inputRef.current &&
            inputRef.current.files &&
            inputRef.current.files.length > 0
          )
            handleLoaded(inputRef.current.files[0]);
        }}
        className="hidden"
      ></input>
    </>
  );
};
