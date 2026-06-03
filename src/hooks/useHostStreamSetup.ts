import { useState, useCallback } from "react";
import { useAppContext } from "../context/AppContext";
import { CURRENT_PAGE_ID } from "../type/App";
import type { Source } from "../types/window";
import { useRoom } from "./useRoom";

export const useHostStreamSetup = () => {
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
    await startHosting(audioStream, audio.latencyMsRef);
    setCurrentPageId(CURRENT_PAGE_ID.VIEW_STREAM);
  }, [audio, selectedVideoSource, setCurrentPageId, startHosting]);

  return {
    selectedVideoSource,
    setSelectedVideoSource,
    handleReturn,
    handleConfirm,
  };
};
