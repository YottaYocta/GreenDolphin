import { useRef, type FC } from "react";

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
