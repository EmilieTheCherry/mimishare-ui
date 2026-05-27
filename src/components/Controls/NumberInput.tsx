type PropsType = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  allowDecimals?: boolean;
  size?: "SMALL" | "NORMAL";
};

const smallClassNames = `px-4 py-1.5 text-sm`;
const normalClassNames = `px-4 py-3 text-2xl`;

export const NumberInput = ({
  value,
  onChange,
  min,
  max,
  allowDecimals = false,
  size = "NORMAL",
}: PropsType) => {
  const sizeClasses = size === "SMALL" ? smallClassNames : normalClassNames;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = allowDecimals ? parseFloat(raw) : parseInt(raw, 10);
    if (isNaN(parsed)) return;
    if (min !== undefined && parsed < min) return;
    if (max !== undefined && parsed > max) return;
    onChange(parsed);
  };

  return (
    <input
      type="number"
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={allowDecimals ? "any" : 1}
      className={`w-64 bg-elevated border border-border text-ink placeholder:text-muted rounded-md outline-none focus:border-accent transition-colors font-medium tracking-wide ${sizeClasses}`}
    />
  );
};
