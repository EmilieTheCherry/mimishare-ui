import { useCallback, useState } from "react";
import { Button } from "./Controls/Button";
import { TextInput } from "./Controls/TextInput";

type PropsType = {
  onHostClick: () => void;
  onJoinRoom: (code: string) => void;
};

export const RoomSelection = ({ onHostClick, onJoinRoom }: PropsType) => {
  const [roomCode, setRoomCode] = useState<string>("");

  const handleJoinRoomClicked = useCallback(() => {
    onJoinRoom(roomCode);
  }, [onJoinRoom, roomCode]);

  return (
    <div className="w-full h-full flex flex-row items-center justify-center gap-32">
      <Button label="Create Room" onClick={onHostClick} />
      <div className="flex flex-col gap-4 items-center">
        <p className="text-center">Join room with code</p>
        <TextInput
          value={roomCode}
          onChange={setRoomCode}
          placeholder="Room Code"
        />
        <Button label="Join Room" onClick={handleJoinRoomClicked} />
      </div>
    </div>
  );
};
