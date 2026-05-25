import { useRef } from "react";
import { VideoPlayback } from "./components/VideoPlayback";
import { Header } from "./components/Header";
import { useRoom } from "./hooks/useRoom";
import { RoomSelection } from "./components/RoomSelection";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { onLeaveRoomClicked, roomCode } = useRoom(videoRef);

  return (
    <main className="bg-canvas text-ink w-full h-full flex flex-col">
      <Header onLeaveRoomClicked={onLeaveRoomClicked} roomCode={roomCode} />
      <VideoPlayback videoRef={videoRef} />
      {!roomCode && <RoomSelection videoRef={videoRef} />}
    </main>
  );
}

export default App;
