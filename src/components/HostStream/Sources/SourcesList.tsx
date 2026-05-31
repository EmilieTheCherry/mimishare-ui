import type { Source } from "../../../types/window";

interface SourcesListProps {
  selectedSource: Source | undefined;
  onSelect: (src: Source) => void;
  sources: Source[];
}

export const SourcesList = ({
  onSelect,
  sources,
  selectedSource,
}: SourcesListProps) => {
  return (
    <div
      className="grid gap-3 w-full justify-center"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 320px))",
      }}
    >
      {sources.map((src) => (
        <button
          key={src.id}
          onClick={() => onSelect(src)}
          title={src.name}
          className={`bg-elevated border rounded-md overflow-hidden text-left transition-colors flex flex-col cursor-pointer ${
            selectedSource?.id === src.id
              ? "border-accent"
              : "border-border hover:border-accent"
          }`}
        >
          {src.thumbnail ? (
            <img
              src={src.thumbnail}
              alt={src.name}
              className="w-full object-cover"
              style={{ aspectRatio: "16/9" }}
            />
          ) : (
            <div
              className="w-full bg-surface"
              style={{ aspectRatio: "16/9" }}
            />
          )}
          <div className="px-3 py-2 flex items-center gap-2">
            <span className="text-ink text-sm font-medium tracking-wide truncate flex-1">
              {src.name}
            </span>
            {src.isDisplay && (
              <span className="text-accent text-xs font-semibold tracking-widest shrink-0">
                DISPLAY
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
