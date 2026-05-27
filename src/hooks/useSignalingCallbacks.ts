import { useCallback } from "react";
import {
  MESSAGE_TYPE,
  ROLE,
  type ClientToServerEvents,
  type IceCandidateEvent,
  type RoomCreatedEvent,
  type SdpAnswerEvent,
  type SdpOfferEvent,
  type ServerToClientEvents,
  type UserJoinedRoomEvent,
} from "../type/WebSocketEvent";
import type { Socket } from "socket.io-client";
import type { RtcPool } from "./useRTCPeerConnectionsHandler";

export const useSignalingCallbacks = (
  rtcPool: RtcPool,
  signalingWebSocketRef: React.RefObject<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>,
  setRoomCode: (v: string) => void,
  role: string | undefined,
  mediaStream: MediaStream | undefined,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) => {
  const onDisconnect = useCallback(() => {
    console.log(`Disconnected with id ${signalingWebSocketRef.current?.id}`);
  }, [signalingWebSocketRef]);

  const onIceCandidate = useCallback(
    async (iceCandidatePayoad: IceCandidateEvent) => {
      const ice = iceCandidatePayoad.ice;
      console.log(`Ice Candidates received "${ice}"`);
      await rtcPool.addIceCandidate(iceCandidatePayoad.from, ice);
    },
    [rtcPool],
  );

  const onIceCandidateFound = useCallback(
    (event: RTCPeerConnectionIceEvent, to: string) => {
      if (event.candidate) {
        console.log(`Ice Candidates found "${event.candidate}"`);
        signalingWebSocketRef.current?.emit(MESSAGE_TYPE.ICE_CANDIDATE, {
          ice: event.candidate,
          to: to,
        });
      }
    },
    [signalingWebSocketRef],
  );

  const onOffer = useCallback(
    async (sdpOfferPayload: SdpOfferEvent) => {
      rtcPool.createPeerConnection(sdpOfferPayload.from);

      await rtcPool.addOnTrackCallback(
        sdpOfferPayload.from,
        (stream: MediaStream) => {
          videoRef.current!.srcObject = stream;
        },
      );

      await rtcPool.addOnIceCandidateCallback(
        sdpOfferPayload.from,
        (event: RTCPeerConnectionIceEvent) =>
          onIceCandidateFound(event, sdpOfferPayload.from),
      );

      const offer = sdpOfferPayload.offer;
      console.log(`Offer received "${JSON.stringify(offer)}"`);
      await rtcPool.setRemoteDescription(sdpOfferPayload.from, offer);

      const answer = await rtcPool.createAnswer(sdpOfferPayload.from);
      await rtcPool.setLocalDescription(sdpOfferPayload.from, answer);
      signalingWebSocketRef.current?.emit(MESSAGE_TYPE.ANSWER, {
        answer: answer,
        to: sdpOfferPayload.from,
      });
    },
    [rtcPool, signalingWebSocketRef, videoRef, onIceCandidateFound],
  );

  const onAnswer = useCallback(
    async (sdpAnswerPayload: SdpAnswerEvent) => {
      const answer = sdpAnswerPayload.answer;
      console.log(`Answer received "${JSON.stringify(answer)}"`);
      await rtcPool.setRemoteDescription(sdpAnswerPayload.from, answer);
    },
    [rtcPool],
  );

  const onUserJoinedRoom = useCallback(
    async (userJoinedRoomPayload: UserJoinedRoomEvent) => {
      const newUserId = userJoinedRoomPayload.from;
      const newUserRole = userJoinedRoomPayload.role;
      console.log(`User "${newUserId}" joined room with role "${newUserRole}"`);
      if (newUserRole === ROLE.VIEWER && role === ROLE.HOST) {
        rtcPool.createPeerConnection(newUserId);
        await rtcPool.addOnIceCandidateCallback(
          userJoinedRoomPayload.from,
          (event: RTCPeerConnectionIceEvent) =>
            onIceCandidateFound(event, userJoinedRoomPayload.from),
        );
        if (!mediaStream)
          throw new Error(
            "Media Stream is undefined, cannot initialize WebRTC connection with media stream !",
          );
        // initWebRTC
        await rtcPool.initWebRTCStream(userJoinedRoomPayload.from, mediaStream);

        signalingWebSocketRef.current?.emit(MESSAGE_TYPE.OFFER, {
          to: newUserId,
          offer: rtcPool.getLocalDescription(userJoinedRoomPayload.from),
        });
      }
    },
    [mediaStream, onIceCandidateFound, role, rtcPool, signalingWebSocketRef],
  );

  const onRoomCreated = useCallback(
    (roomCreatedPayload: RoomCreatedEvent) => {
      setRoomCode(roomCreatedPayload.roomCode);
    },
    [setRoomCode],
  );

  return {
    onUserJoinedRoom,
    onAnswer,
    onDisconnect,
    onIceCandidate,
    onOffer,
    onRoomCreated,
  };
};
