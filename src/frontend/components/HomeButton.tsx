import { useNavigate } from "react-router";
import { HouseIcon } from "@phosphor-icons/react";

const headerBtn = "btn-surface rounded-lg gap-3 px-3.25 py-3.25";
const headerBtnLabel =
  "opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden";

export function HomeButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/")}
      className={`${headerBtn} w-full h-12 cursor-pointer`}
    >
      <HouseIcon size={18} weight="fill" color="var(--color-icon)" style={{ opacity: 0.5, flexShrink: 0 }} />
      <span className={headerBtnLabel}>Home</span>
    </button>
  );
}
