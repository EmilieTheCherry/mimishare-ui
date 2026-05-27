import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  MESSAGE_TYPE,
  ROLE,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "../type/WebSocketEvent";
import { useSignalingCallbacks } from "../hooks/useSignalingCallbacks";
import { getEnv } from "../env";
import { useRTCPeerConnectionsHandler } from "../hooks/useRTCPeerConnectionsHandler";
import { useStreamSettingsContext } from "./StreamSettingsContext";

type AppContextType = {
  roomCode: string | undefined;
  setRoomCode: (v: string) => void;
  signalingWebSocketRef: React.RefObject<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>;
  role: keyof typeof ROLE | undefined;
  setRole: (role: keyof typeof ROLE | undefined) => void;
  mediaStream: MediaStream | undefined;
  setMediaStream: (mediaStream: MediaStream | undefined) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

const AppContext = createContext<AppContextType | null>(null);

const domain = getEnv("VITE_SIGNALINGSERVER_URL");
const protocol = getEnv("VITE_NODE_ENV") === "production" ? "https" : "http";
const port =
  getEnv("VITE_NODE_ENV") === "production"
    ? "443"
    : getEnv("VITE_SIGNALINGSERVER_PORT");

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { preferredCodec } = useStreamSettingsContext();
  const [mediaStream, setMediaStream] = useState<MediaStream | undefined>(
    undefined,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const rtcPool = useRTCPeerConnectionsHandler(preferredCodec);
  const [role, setRole] = useState<keyof typeof ROLE | undefined>(undefined);
  const [roomCode, setRoomCode] = useState<string | undefined>(undefined);
  const signalingWebSocketRef = useRef<Socket | null>(null);
  const {
    onAnswer,
    onDisconnect,
    onIceCandidate,
    onOffer,
    onUserJoinedRoom,
    onRoomCreated,
  } = useSignalingCallbacks(
    rtcPool,
    signalingWebSocketRef,
    setRoomCode,
    role,
    mediaStream,
    videoRef,
  );

  useEffect(() => {
    if (!signalingWebSocketRef.current) {
      signalingWebSocketRef.current = io(`${protocol}://${domain}:${port}`);
    }
    console.log("Set all listeners");
    signalingWebSocketRef.current.on("connect", () =>
      console.log(`Connected with id ${signalingWebSocketRef.current?.id}`),
    );
    signalingWebSocketRef.current.on("disconnect", onDisconnect);
    signalingWebSocketRef.current.on(
      MESSAGE_TYPE.USER_JOINED_ROOM,
      onUserJoinedRoom,
    );
    signalingWebSocketRef.current.on(
      MESSAGE_TYPE.ICE_CANDIDATE,
      onIceCandidate,
    );
    signalingWebSocketRef.current.on(MESSAGE_TYPE.OFFER, onOffer);
    signalingWebSocketRef.current.on(MESSAGE_TYPE.ANSWER, onAnswer);
    signalingWebSocketRef.current.on(MESSAGE_TYPE.ROOM_CREATED, onRoomCreated);
    return () => {
      signalingWebSocketRef.current!.removeAllListeners();
    };
  }, [
    onAnswer,
    onDisconnect,
    onIceCandidate,
    onOffer,
    onRoomCreated,
    onUserJoinedRoom,
  ]);

  useEffect(() => {
    return () => {
      signalingWebSocketRef.current?.offAny();
      signalingWebSocketRef.current?.disconnect();
      signalingWebSocketRef.current = null;
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      roomCode,
      setRoomCode,
      signalingWebSocketRef,
      role,
      setRole,
      mediaStream,
      setMediaStream,
      videoRef,
    }),
    [mediaStream, role, roomCode],
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx)
    throw new Error("useAppContext must be used inside AppContextProvider");
  return ctx;
};
