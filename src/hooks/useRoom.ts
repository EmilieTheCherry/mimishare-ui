import { useCallback } from "react";
import { MESSAGE_TYPE, ROLE } from "../type/WebSocketEvent";
import { useCaptureScreen } from "./useCaptureScreen";
import { useAppContext } from "../context/AppContext";
import { setVideoTracksContentHint } from "../util/streamContentHint";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";
import { CURRENT_PAGE_ID } from "../type/App";

export const useRoom = () => {
  const {
    roomCode,
    signalingWebSocketRef,
    setRole,
    setRoomCode,
    setMediaStream,
    videoRef,
    setCurrentPageId,
    rtcPool,
    audio,
  } = useAppContext();

  const { videoContentHint } = useStreamSettingsContext();
  const { requestMedia } = useCaptureScreen();

  const onLeaveRoomClicked = useCallback(async () => {
    signalingWebSocketRef.current!.emit(MESSAGE_TYPE.LEAVE_ROOM, {
      roomId: roomCode!,
    });
    setRole(undefined);
    setRoomCode(undefined);
    setCurrentPageId(CURRENT_PAGE_ID.HOME);
    await rtcPool.closeAllConnections();
    await audio.stop();
  }, [
    audio,
    roomCode,
    rtcPool,
    setCurrentPageId,
    setRole,
    setRoomCode,
    signalingWebSocketRef,
  ]);

  const joinRoom = useCallback(
    (role: keyof typeof ROLE, roomCode?: string) => {
      setRole(role);
      signalingWebSocketRef.current!.emit(MESSAGE_TYPE.JOIN_ROOM, {
        role: role,
        roomId: roomCode,
      });

      setCurrentPageId(CURRENT_PAGE_ID.VIEW_STREAM);
    },
    [setCurrentPageId, setRole, signalingWebSocketRef],
  );

  const onJoinRoomClicked = useCallback(
    (roomCode: string) => {
      try {
        joinRoom(ROLE.VIEWER, roomCode);
      } catch (e: unknown) {
        console.error("Error while joining room: ", e);
      }
    },
    [joinRoom],
  );

  const startHosting = useCallback(
    async (audioStream?: MediaStream | null) => {
      try {
        const videoStream = await requestMedia();

        audioStream?.getAudioTracks().forEach((t) => videoStream.addTrack(t));
        setMediaStream(videoStream);

        if (!videoStream) return;
        await setVideoTracksContentHint(videoStream, videoContentHint);

        if (!videoRef.current) return;
        videoRef.current.srcObject = videoStream;
        joinRoom(ROLE.HOST);
      } catch (e: unknown) {
        console.error("Error while starting hosting: ", e);
      }
    },
    [joinRoom, requestMedia, setMediaStream, videoContentHint, videoRef],
  );

  return {
    roomCode,
    startHosting,
    onLeaveRoomClicked,
    onJoinRoomClicked,
  };
};
