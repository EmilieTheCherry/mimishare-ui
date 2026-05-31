import { useCallback, useState } from "react";
import { CURRENT_PAGE_ID } from "../../../type/App";
import { Button } from "../../Controls/Button";
import { SourcePicker } from "../Sources/SourcePicker";
import { HostConfiguration } from "./HostConfiguration";
import { useAppContext } from "../../../context/AppContext";
import { useRoom } from "../../../hooks/useRoom";
import type { Source } from "../../../types/window";

export const HostStreamSetup = () => {
  const [selectedVideoSource, setSelectedVideoSource] = useState<
    Source | undefined
  >(undefined);
  const { setCurrentPageId, audio } = useAppContext();
  const { startHosting } = useRoom();

  const handleReturn = useCallback(() => {
    setCurrentPageId(CURRENT_PAGE_ID.HOME);
  }, [setCurrentPageId]);

  const handleConfirm = useCallback(async () => {
    if (!selectedVideoSource) return;
    await window.screenCapture?.setSource(selectedVideoSource.id);
    let audioStream: MediaStream | undefined;
    if (selectedVideoSource.pid !== null && selectedVideoSource.pid !== 0) {
      try {
        audioStream = await audio.start(selectedVideoSource.pid);
      } catch (e) {
        console.error("[App] audio start failed:", e);
      }
    }
    await startHosting(audioStream);
    setCurrentPageId(CURRENT_PAGE_ID.VIEW_STREAM);
  }, [audio, selectedVideoSource, setCurrentPageId, startHosting]);

  return (
    <div className="w-full h-full flex">
      <div className="flex-0">
        <HostConfiguration />
      </div>
      <div className="flex flex-col justify-between flex-1 border-l-2 border-l-elevated ml-8 pl-2">
        <SourcePicker
          selectedSource={selectedVideoSource}
          setSelectedSource={setSelectedVideoSource}
        />
        <div className="flex gap-4 justify-end">
          <Button
            label="Cancel"
            onClick={handleReturn}
            size="SMALL"
            variant="SECONDARY"
          />
          <Button
            label="Confirm"
            onClick={handleConfirm}
            size="SMALL"
            disabled={selectedVideoSource == undefined}
          />
        </div>
      </div>
    </div>
  );
};
