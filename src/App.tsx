import { useCallback } from "react";
import { VideoPlayback } from "./components/VideoPlayback";
import { Header } from "./components/Header";
import { useRoom } from "./hooks/useRoom";
import { RoomSelection } from "./components/RoomSelection";
import { useAppContext } from "./context/AppContext";
import { CURRENT_PAGE_ID } from "./type/App";
import { HostStreamSetup } from "./components/HostStream/HostConfiguration/HostStreamSetup";

function App() {
  const { videoRef, roomCode, currentPageId, setCurrentPageId } =
    useAppContext();
  const { onLeaveRoomClicked, onJoinRoomClicked } = useRoom();

  const handleHostClick = useCallback(() => {
    setCurrentPageId(CURRENT_PAGE_ID.SETUP_HOST_STREAM);
  }, [setCurrentPageId]);

  return (
    <div className="w-full h-full flex flex-col">
      <Header onLeaveRoomClicked={onLeaveRoomClicked} roomCode={roomCode} />
      <main className="bg-canvas text-ink w-full flex-1 flex flex-col p-8">
        <VideoPlayback videoRef={videoRef} />
        {currentPageId === CURRENT_PAGE_ID.SETUP_HOST_STREAM && (
          <HostStreamSetup />
        )}
        {currentPageId === CURRENT_PAGE_ID.HOME && (
          <RoomSelection
            onHostClick={handleHostClick}
            onJoinRoom={onJoinRoomClicked}
          />
        )}
      </main>
    </div>
  );
}

export default App;
