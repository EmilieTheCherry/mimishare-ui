import { useCallback } from "react";
import { MESSAGE_TYPE, ROLE } from "../type/WebSocketEvent";
import { useHostStream } from "./useHostStream";
import { useCaptureScreen } from "./useCaptureScreen";
import { useAppContext } from "../context/AppContext";

export const useRoom = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const { roomCode, signalingWebSocketRef, setRole } = useAppContext();
  const { setupHost, setupViewer } = useHostStream();
  const { requestMedia } = useCaptureScreen();

  const onLeaveRoomClicked = useCallback(() => {}, []);

  const joinRoom = useCallback(
    (role: keyof typeof ROLE, roomCode?: string) => {
      setRole(role);
      signalingWebSocketRef.current!.emit(MESSAGE_TYPE.JOIN_ROOM, {
        role: role,
        roomId: roomCode,
      });
    },
    [setRole, signalingWebSocketRef],
  );

  const onJoinRoomClicked = useCallback(
    (roomCode: string) => {
      if (!videoRef.current) return;
      try {
        setupViewer(videoRef as React.RefObject<HTMLVideoElement>);
        joinRoom(ROLE.VIEWER, roomCode);
      } catch (e: unknown) {
        console.error("Error while requesting media stream : ", e);
      }
    },
    [joinRoom, setupViewer, videoRef],
  );

  const onCreateRoomClicked = useCallback(async () => {
    try {
      const stream = await requestMedia();

      if (!stream) return;
      await setupHost(stream);

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      joinRoom(ROLE.HOST);
    } catch (e: unknown) {
      console.error("Error while requesting media stream : ", e);
    }
  }, [joinRoom, requestMedia, setupHost, videoRef]);
  return {
    roomCode,
    onCreateRoomClicked,
    onLeaveRoomClicked,
    onJoinRoomClicked,
  };
};
