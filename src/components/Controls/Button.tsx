import { useMemo } from "react";

type PropsType = {
  onClick: () => void;
  label: string;
  size?: "SMALL" | "NORMAL";
};

const smallClassNames = `px-4 py-1.5 font-medium text-sm`;
const normalClassNames = `p-3 text-2xl`;

export const Button = ({ onClick, label, size = "NORMAL" }: PropsType) => {
  const sizeClasses = useMemo(
    () => (size == "SMALL" ? smallClassNames : normalClassNames),
    [size],
  );
  return (
    <button
      className={`w-64 bg-accent hover:bg-accent-dark text-ink rounded-md cursor-pointer transition-colors ${sizeClasses}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
