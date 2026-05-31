import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import type { Source } from "../../../types/window";
import { SourcesList } from "./SourcesList";

type SourcePickerProps = {
  selectedSource: Source | undefined;
  setSelectedSource: (source: Source) => void;
};

export function SourcePicker({
  selectedSource,
  setSelectedSource,
}: SourcePickerProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.sources)
        throw new Error("Electron preloaded function missing : window.source");
      setSources(await window.sources.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises, react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-1 p-4 w-full">
      {error && (
        <div className="mx-4 mt-4 p-3 bg-elevated border border-border rounded-md text-sm text-muted">
          {error}
        </div>
      )}

      <div className="mb-4 flex justify-center items-center gap-3 ">
        <span>Select a source to stream</span>
        <RefreshCw onClick={load} size={20} cursor={"pointer"} />
      </div>
      {loading ? (
        <div className="w-16 h-16 rounded-full m-auto mt-15 border-2 border-border border-t-accent animate-spin" />
      ) : (
        <SourcesList
          selectedSource={selectedSource}
          onSelect={setSelectedSource}
          sources={sources}
        />
      )}
    </div>
  );
}
