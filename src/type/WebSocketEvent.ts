export const MESSAGE_TYPE = {
  ROOM_CREATED: "ROOM_CREATED",
  JOIN_ROOM: "JOIN_ROOM",
  LEAVE_ROOM: "LEAVE_ROOM",
  USER_JOINED_ROOM: "USER_JOINED_ROOM",
  OFFER: "OFFER",
  ANSWER: "ANSWER",
  ICE_CANDIDATE: "ICE_CANDIDATE",
  USER_LEFT_ROOM: "USER_LEFT_ROOM",
} as const;

export type FromSocket = {
  from: string;
};

export type ToSocket = {
  to: string;
};

export type Role = {
  role: keyof typeof ROLE;
};

export type LeaveRoomEvent = {
  roomId: string;
};

export type IceCandidateEvent = FromSocket &
  ToSocket & {
    ice: RTCIceCandidateInit;
  };

export type SdpOfferEvent = FromSocket &
  ToSocket & {
    offer: any;
  };

export type SdpAnswerEvent = FromSocket &
  ToSocket & {
    answer: any;
  };

export const ROLE = {
  VIEWER: "VIEWER",
  HOST: "HOST",
} as const;

export type JoinRoomEvent = Role & {
  roomId?: string;
};

export type UserJoinedRoomEvent = FromSocket & Role;
export type UserLeftRoomEvent = FromSocket;
export type RoomCreatedEvent = FromSocket & {
  roomCode: string;
};

export interface ServerToClientEvents {
  [MESSAGE_TYPE.ROOM_CREATED]: (payload: RoomCreatedEvent) => void;
  [MESSAGE_TYPE.USER_LEFT_ROOM]: (payload: UserLeftRoomEvent) => void;
  [MESSAGE_TYPE.USER_JOINED_ROOM]: (payload: UserJoinedRoomEvent) => void;
  [MESSAGE_TYPE.ICE_CANDIDATE]: (payload: IceCandidateEvent) => void;
  [MESSAGE_TYPE.OFFER]: (payload: SdpOfferEvent) => void;
  [MESSAGE_TYPE.ANSWER]: (payload: SdpAnswerEvent) => void;
}

// Events the client emits → server listens
export interface ClientToServerEvents {
  [MESSAGE_TYPE.JOIN_ROOM]: (payload: JoinRoomEvent) => void;
  [MESSAGE_TYPE.ICE_CANDIDATE]: (
    payload: Omit<IceCandidateEvent, "from">,
  ) => void;
  [MESSAGE_TYPE.OFFER]: (payload: Omit<SdpOfferEvent, "from">) => void;
  [MESSAGE_TYPE.ANSWER]: (payload: Omit<SdpAnswerEvent, "from">) => void;
  [MESSAGE_TYPE.LEAVE_ROOM]: (payload: LeaveRoomEvent) => void;
}
