import React from "react";
import { useAppContext } from "../context/AppContext";
type PropsType = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

export const VideoPlayback = ({ videoRef }: PropsType) => {
  const { roomCode } = useAppContext();
  return (
    <video
      autoPlay
      ref={videoRef}
      className={`m-auto w-8/10 rounded-lg ${!roomCode ? "hidden" : ""}`}
      controls
    />
  );
};
