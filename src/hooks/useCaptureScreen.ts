import { useCallback } from "react";

export const useCaptureScreen = () => {
  const requestMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: 1920,
        height: 1080,
        frameRate: 60,
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
  }, []);
  return { requestMedia };
};
