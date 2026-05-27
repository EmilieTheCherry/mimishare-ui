import { useCallback } from "react";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";
import { RESOLUTION } from "../type/Settings";

export const useCaptureScreen = () => {
  const { resolutionId } = useStreamSettingsContext();
  const requestMedia = useCallback(async () => {
    const resolution = RESOLUTION[resolutionId];
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: resolution.width,
        height: resolution.height,
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    const hasAudio = stream.getAudioTracks().length > 0;
    if (!hasAudio) {
      console.warn(
        "No system audio captured. Possible reasons:\n" +
          "- macOS/Firefox: system audio capture is not supported\n" +
          "- Windows/Chrome: user did not check 'Share system audio' in the picker",
      );
    }
    return stream;
  }, [resolutionId]);
  return { requestMedia };
};

// import { useCallback, useMemo } from "react";
// import { ThrottledScreenCapture } from "../util/throttleStream";

// export const useCaptureScreen = (captureTargetFps: number) => {
//   const capture = useMemo(() => new ThrottledScreenCapture(), []);
//   const requestMedia = useCallback(async () => {
//     const throttledStream = await capture.start(captureTargetFps);

//     const hasAudio = throttledStream.getAudioTracks().length > 0;
//     if (!hasAudio) {
//       console.warn(
//         "No system audio captured. Possible reasons:\n" +
//           "- macOS/Firefox: system audio capture is not supported\n" +
//           "- Windows/Chrome: user did not check 'Share system audio' in the picker",
//       );
//     }
//     return throttledStream;
//   }, [capture, captureTargetFps]);
//   return { requestMedia };
// };
