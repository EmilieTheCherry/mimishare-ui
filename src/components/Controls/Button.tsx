import { useMemo, type ReactNode } from "react";

type PropsType = {
  onClick: () => void;
  label: string;
  size?: "SMALL" | "NORMAL";
  variant?: "PRIMARY" | "SECONDARY";
  icon?: ReactNode;
  disabled?: boolean;
  classNames?: string;
};

const smallClassNames = `w-24 px-4 py-1.5 font-medium text-sm`;
const normalClassNames = `w-48 p-3 text-2xl`;

const primaryClassNames = `bg-accent hover:bg-accent-dark text-ink`;
const secondaryClassNames = `bg-transparent hover:bg-surface-hover text-ink-muted border border-border`;

const notDisabledClassNames = `cursor-pointer`;
const disabledClassNames = `opacity-50`;

export const Button = ({
  onClick,
  label,
  disabled,
  size = "NORMAL",
  variant = "PRIMARY",
  classNames = "",
}: PropsType) => {
  const sizeClasses = useMemo(
    () => (size == "SMALL" ? smallClassNames : normalClassNames),
    [size],
  );

  const variantClasses = useMemo(
    () => (variant == "PRIMARY" ? primaryClassNames : secondaryClassNames),
    [variant],
  );

  const disabledClass = useMemo(
    () => (disabled ? disabledClassNames : notDisabledClassNames),
    [disabled],
  );

  return (
    <button
      className={`'${classNames} ${sizeClasses} ${variantClasses} ${disabledClass} rounded-md  transition-colors`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
