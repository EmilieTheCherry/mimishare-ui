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

type AppContextType = {
  roomCode: string | undefined;
  setRoomCode: (v: string) => void;
  peerConnectionRef: React.RefObject<RTCPeerConnection | null>;
  signalingWebSocketRef: React.RefObject<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>;
  role: keyof typeof ROLE | undefined;
  setRole: (role: keyof typeof ROLE | undefined) => void;
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
  const [role, setRole] = useState<keyof typeof ROLE | undefined>(undefined);
  const [roomCode, setRoomCode] = useState<string | undefined>(undefined);
  const signalingWebSocketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const {
    onAnswer,
    onDisconnect,
    onIceCandidate,
    onOffer,
    onUserJoinedRoom,
    onRoomCreated,
  } = useSignalingCallbacks(
    peerConnectionRef,
    signalingWebSocketRef,
    setRoomCode,
  );

  useEffect(() => {
    if (peerConnectionRef.current) return;
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:signaling-mimishare.emiliethecherry.ovh:3478",
          username: "login",
          credential: "password",
        },
      ],
    });
    return () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, [peerConnectionRef]);

  useEffect(() => {
    if (signalingWebSocketRef.current) return;
    signalingWebSocketRef.current = io(`${protocol}://${domain}:${port}`);
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
      signalingWebSocketRef.current?.offAny();
      signalingWebSocketRef.current?.disconnect();
      signalingWebSocketRef.current = null;
    };
  }, [
    onAnswer,
    onDisconnect,
    onIceCandidate,
    onOffer,
    onRoomCreated,
    onUserJoinedRoom,
    peerConnectionRef,
  ]);

  const contextValue = useMemo(
    () => ({
      roomCode,
      setRoomCode,
      peerConnectionRef,
      signalingWebSocketRef,
      role,
      setRole,
    }),
    [role, roomCode],
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
