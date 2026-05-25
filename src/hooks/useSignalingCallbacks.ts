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

export const useSignalingCallbacks = (
  peerConnectionRef: React.RefObject<RTCPeerConnection | null>,
  signalingWebSocketRef: React.RefObject<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>,
  setRoomCode: (v: string) => void,
) => {
  const onDisconnect = useCallback(() => {
    console.log(`Disconnected with id ${signalingWebSocketRef.current?.id}`);
  }, [signalingWebSocketRef]);

  const onIceCandidate = useCallback(
    async (IceCandidatePayoad: IceCandidateEvent) => {
      const ice = IceCandidatePayoad.ice;
      console.log(`Ice Candidates received "${ice}"`);
      await peerConnectionRef.current?.addIceCandidate(ice);
    },
    [peerConnectionRef],
  );

  const onIceCandidateFound = useCallback(
    (event: RTCPeerConnectionIceEvent, to: string) => {
      if (event.candidate) {
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
      peerConnectionRef.current!.onicecandidate = (
        event: RTCPeerConnectionIceEvent,
      ) => onIceCandidateFound(event, sdpOfferPayload.from);

      const offer = sdpOfferPayload.offer;
      console.log(`Offer received "${JSON.stringify(offer)}"`);
      await peerConnectionRef.current!.setRemoteDescription(offer);
      if (!peerConnectionRef.current) {
        throw new Error("Peer connection not ready for setup !");
      }
      const answer = await peerConnectionRef.current!.createAnswer();
      await peerConnectionRef.current!.setLocalDescription(answer);
      signalingWebSocketRef.current?.emit(MESSAGE_TYPE.ANSWER, {
        answer: peerConnectionRef.current?.localDescription,
        to: sdpOfferPayload.from,
      });
    },
    [onIceCandidateFound, peerConnectionRef, signalingWebSocketRef],
  );

  const onAnswer = useCallback(
    async (sdpAnswerPayload: SdpAnswerEvent) => {
      peerConnectionRef.current!.onicecandidate = (
        event: RTCPeerConnectionIceEvent,
      ) => onIceCandidateFound(event, sdpAnswerPayload.from);

      const answer = sdpAnswerPayload.answer;
      console.log(`Answer received "${JSON.stringify(answer)}"`);
      await peerConnectionRef.current!.setRemoteDescription(answer);
    },
    [onIceCandidateFound, peerConnectionRef],
  );

  const onUserJoinedRoom = useCallback(
    (userJoinedRoomPayload: UserJoinedRoomEvent) => {
      const newUserId = userJoinedRoomPayload.from;
      const newUserRole = userJoinedRoomPayload.role;
      console.log(`User "${newUserId}" joined room with role "${newUserRole}"`);
      console.log(peerConnectionRef.current);
      if (
        newUserRole === ROLE.VIEWER &&
        peerConnectionRef.current?.localDescription
      ) {
        signalingWebSocketRef.current?.emit(MESSAGE_TYPE.OFFER, {
          to: newUserId,
          offer: peerConnectionRef.current?.localDescription,
        });
      }
    },
    [peerConnectionRef, signalingWebSocketRef],
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
