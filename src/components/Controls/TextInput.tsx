type PropsType = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "SMALL" | "NORMAL";
};

const smallClassNames = `px-4 py-1.5 text-sm`;
const normalClassNames = `px-4 py-3 text-2xl`;

export const TextInput = ({
  value,
  onChange,
  placeholder,
  size = "NORMAL",
}: PropsType) => {
  const sizeClasses = size === "SMALL" ? smallClassNames : normalClassNames;

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-64 bg-elevated border border-border text-ink placeholder:text-muted rounded-md outline-none focus:border-accent transition-colors font-medium tracking-wide ${sizeClasses}`}
    />
  );
};
