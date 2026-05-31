import { createContext, useContext, useMemo, useState } from "react";
import {
  type CodecType,
  type RESOLUTIONS_IDS_TYPE,
  type VideoContentHintType,
  CODEC,
  RESOLUTIONS_IDS,
  VIDEO_CONTENT_HINT,
} from "../type/Settings";

type StreamSettingsContextType = {
  preferredCodec: CodecType;
  setPreferredCodec: (codec: CodecType) => void;
  captureTargetFps: number;
  setCaptureTargetFps: (codcaptureTargetFpsec: number) => void;
  videoContentHint: VideoContentHintType;
  setVideoContentHint: (contentHint: VideoContentHintType) => void;
  resolutionId: RESOLUTIONS_IDS_TYPE;
  setResolutionId: (resolution: RESOLUTIONS_IDS_TYPE) => void;
};

const StreamSettingsContext = createContext<StreamSettingsContextType | null>(
  null,
);

export const StreamSettingsContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [captureTargetFps, setCaptureTargetFps] = useState<number>(30);
  const [preferredCodec, setPreferredCodec] = useState<CodecType>(CODEC.VP9);
  const [videoContentHint, setVideoContentHint] =
    useState<VideoContentHintType>(VIDEO_CONTENT_HINT.MOTION);
  const [resolutionId, setResolutionId] = useState<RESOLUTIONS_IDS_TYPE>(
    RESOLUTIONS_IDS.R1080P,
  );

  const contextValue = useMemo(
    () => ({
      preferredCodec,
      setPreferredCodec,
      captureTargetFps,
      setCaptureTargetFps,
      videoContentHint,
      setVideoContentHint,
      resolutionId,
      setResolutionId,
    }),
    [captureTargetFps, preferredCodec, resolutionId, videoContentHint],
  );

  return (
    <StreamSettingsContext.Provider value={contextValue}>
      {children}
    </StreamSettingsContext.Provider>
  );
};

export const useStreamSettingsContext = () => {
  const ctx = useContext(StreamSettingsContext);
  if (!ctx)
    throw new Error(
      "useStreamSettingsContext must be used inside StreamSettingsContextProvider",
    );
  return ctx;
};
