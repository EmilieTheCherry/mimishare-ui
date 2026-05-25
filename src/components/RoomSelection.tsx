import { useCallback } from "react";
import { useRoom } from "../hooks/useRoom";
import { Button } from "./Controls/Button";
import React from "react";

type PropsType = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

export const RoomSelection = ({ videoRef }: PropsType) => {
  const { onCreateRoomClicked, onJoinRoomClicked } = useRoom(videoRef);
  const roomCodeInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleJoinRoomClicked = useCallback(() => {
    onJoinRoomClicked(roomCodeInputRef.current!.value);
  }, [onJoinRoomClicked]);

  return (
    <div className="w-full h-full flex justify-center items-center gap-32">
      <Button label="Create Room" onClick={onCreateRoomClicked} />
      <div className="flex flex-col">
        <p className="text-center">Join room with code</p>
        <input type="text" ref={roomCodeInputRef} />
        <Button label="Join Room" onClick={handleJoinRoomClicked} />
      </div>
    </div>
  );
};
