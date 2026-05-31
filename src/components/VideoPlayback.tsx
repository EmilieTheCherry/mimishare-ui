import React from "react";
import { useAppContext } from "../context/AppContext";
import { ROLE } from "../type/WebSocketEvent";
type PropsType = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

export const VideoPlayback = ({ videoRef }: PropsType) => {
  const { roomCode, role } = useAppContext();
  return (
    <video
      autoPlay
      ref={videoRef}
      className={`m-auto w-8/10 rounded-lg ${!roomCode ? "hidden" : ""}`}
      controls
    />
  );
};
