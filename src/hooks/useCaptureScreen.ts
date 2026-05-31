import { useCallback } from "react";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";
import { RESOLUTION } from "../type/Settings";

export const useCaptureScreen = () => {
  const { resolutionId, captureTargetFps } = useStreamSettingsContext();

  const requestMedia = useCallback(async () => {
    const resolution = RESOLUTION[resolutionId];
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: resolution.width,
        height: resolution.height,
        frameRate: { ideal: captureTargetFps, max: captureTargetFps },
      },
      audio: false,
    });

    return stream;
  }, [captureTargetFps, resolutionId]);

  return { requestMedia };
};
