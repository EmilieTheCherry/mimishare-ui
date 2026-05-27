import { useCallback } from "react";
import { MESSAGE_TYPE, ROLE } from "../type/WebSocketEvent";
import { useCaptureScreen } from "./useCaptureScreen";
import { useAppContext } from "../context/AppContext";
import { setVideoTracksContentHint } from "../util/streamContentHint";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";

export const useRoom = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const { roomCode, signalingWebSocketRef, setRole, setMediaStream } =
    useAppContext();

  const { videoContentHint } = useStreamSettingsContext();
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
        joinRoom(ROLE.VIEWER, roomCode);
      } catch (e: unknown) {
        console.error("Error while requesting media stream : ", e);
      }
    },
    [joinRoom, videoRef],
  );

  const onCreateRoomClicked = useCallback(async () => {
    try {
      const stream = await requestMedia();
      setMediaStream(stream);

      if (!stream) return;
      await setVideoTracksContentHint(stream, videoContentHint);

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      joinRoom(ROLE.HOST);
    } catch (e: unknown) {
      console.error("Error while requesting media stream : ", e);
    }
  }, [joinRoom, requestMedia, setMediaStream, videoContentHint, videoRef]);

  return {
    roomCode,
    onCreateRoomClicked,
    onLeaveRoomClicked,
    onJoinRoomClicked,
  };
};
