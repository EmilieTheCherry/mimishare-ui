import { Button } from "./Controls/Button";

type PropsType = {
  onLeaveRoomClicked: () => void;
  roomCode?: string;
};

export const Header = ({ onLeaveRoomClicked, roomCode }: PropsType) => {
  return (
    <header className="bg-surface border-b border-border flex items-center gap-2 px-4 py-2.5">
      <span className="text-2xl mr-auto select-none">MimiShare</span>
      {roomCode && (
        <>
          <span>Room Code: {roomCode}</span>
          <Button
            label="Leave Room"
            onClick={onLeaveRoomClicked}
            size="SMALL"
          />
        </>
      )}
    </header>
  );
};
