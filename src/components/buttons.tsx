import { useRef, type FC, type ReactNode } from "react";

export interface LoadButtonProps {
  handleLoaded: (file: File) => void;
}

export const LoadButton: FC<LoadButtonProps> = ({ handleLoaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <input
      type="file"
      ref={inputRef}
      className="p-2 rounded-xs border border-neutral-300 max-w-48"
      onInput={() => {
        if (
          inputRef.current &&
          inputRef.current.files &&
          inputRef.current.files.length > 0
        )
          handleLoaded(inputRef.current.files[0]);
      }}
    ></input>
  );
};

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
      className={`hover:bg-neutral-100 p-1 rounded-full h-min w-min ${className}`}
      onClick={onClick}
    >
      {iconPlacement === "left" && icon}
      {text}
      {iconPlacement === "right" && icon}
    </button>
  );
};
