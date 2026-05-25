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
      className={`max-w-full max-h-full rounded-lg ${!roomCode ? "hidden" : ""}`}
      controlsList=""
      muted={role === ROLE.HOST}
    />
  );
};
