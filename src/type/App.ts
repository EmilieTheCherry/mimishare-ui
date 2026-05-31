export const CURRENT_PAGE_ID = {
  HOME: "HOME",
  SETUP_HOST_STREAM: "SETUP_HOST_STREAM",
  VIEW_STREAM: "VIEW_STREAM",
} as const;

export type CurrentPageIdType =
  (typeof CURRENT_PAGE_ID)[keyof typeof CURRENT_PAGE_ID];

export type RTCPeerConnectionDetail = {
  connection: RTCPeerConnection;
  debugIntervalId: number;
};
