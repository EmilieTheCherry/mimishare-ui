import { useCallback } from "react";
import { MESSAGE_TYPE, ROLE } from "../type/WebSocketEvent";
import { useCaptureScreen } from "./useCaptureScreen";
import { useAppContext } from "../context/AppContext";
import { setVideoTracksContentHint } from "../util/streamContentHint";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";
import { CURRENT_PAGE_ID } from "../type/App";
import { delayVideoStream } from "../util/delayVideoStream";

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

  const configureStream = useCallback(
    async (
      delayMsRef: { current: number },
      videoStream: MediaStream,
      audioStream?: MediaStream | null,
    ) => {
      const delayedVideoStream = delayVideoStream(videoStream, delayMsRef);
      await setVideoTracksContentHint(delayedVideoStream, videoContentHint);

      const finalStream = new MediaStream();
      finalStream.addTrack(delayedVideoStream.getVideoTracks()[0]);
      audioStream?.getAudioTracks().forEach((t) => finalStream.addTrack(t));

      return finalStream;
    },
    [videoContentHint],
  );

  const startHosting = useCallback(
    async (
      audioStream: MediaStream | undefined,
      delayMsRef: { current: number },
    ) => {
      try {
        const videoStream = await requestMedia();
        const hostStream = await configureStream(
          delayMsRef,
          videoStream,
          audioStream,
        );
        setMediaStream(hostStream);
        joinRoom(ROLE.HOST);
        if (!videoRef.current) return;
        videoRef.current.srcObject = hostStream;
      } catch (e: unknown) {
        console.error("Error while starting hosting: ", e);
      }
    },
    [configureStream, joinRoom, requestMedia, setMediaStream, videoRef],
  );

  return {
    roomCode,
    startHosting,
    onLeaveRoomClicked,
    onJoinRoomClicked,
  };
};
