import { type FC, type MouseEventHandler, type ReactNode } from "react";

export interface ButtonProps {
  icon?: ReactNode;
  text?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
  tooltip?: string;
  iconPlacement?: "left" | "right";
  id?: string;
}

export const Button: FC<ButtonProps> = ({
  icon,
  text,
  onClick,
  className,
  ariaLabel,
  tooltip,
  iconPlacement = "left",
  id,
}) => {
  return (
    <button
      aria-label={ariaLabel}
      className={`bg-white hover:bg-neutral-100 p-1 px-2 rounded-full h-min w-min flex items-center justify-center text-center gap-1 flex-nowrap text-nowrap cursor-pointer ${className}`}
      onClick={onClick}
      title={tooltip}
      id={id}
    >
      {iconPlacement === "left" && icon && (
        <span className="text-neutral-500 text-center flex items-center justify-center w-min">
          {icon}
        </span>
      )}
      {text && <span className="text-center">{text}</span>}
      {iconPlacement === "right" && icon && (
        <span className="text-neutral-500 text-center flex items-center justify-center w-min">
          {icon}
        </span>
      )}
    </button>
  );
};
