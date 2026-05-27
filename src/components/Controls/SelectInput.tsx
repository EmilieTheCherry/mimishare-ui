type OptionType<T extends string> = {
  label: string;
  value: T;
};

type PropsType<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: OptionType<T>[];
  size?: "SMALL" | "NORMAL";
};

const smallClassNames = `px-4 py-1.5 text-sm`;
const normalClassNames = `px-4 py-3 text-2xl`;

export const SelectInput = <T extends string>({
  value,
  onChange,
  options,
  size = "NORMAL",
}: PropsType<T>) => {
  const sizeClasses = size === "SMALL" ? smallClassNames : normalClassNames;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`w-64 bg-elevated border border-border text-ink rounded-md outline-none focus:border-accent transition-colors font-medium tracking-wide cursor-pointer ${sizeClasses}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-elevated">
          {opt.label}
        </option>
      ))}
    </select>
  );
};
