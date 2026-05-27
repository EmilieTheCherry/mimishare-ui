import React, { useCallback, useEffect } from "react";
import { prioritizeCodec } from "../util/codecOrdering";

export type RtcPool = {
  createPeerConnection: (id: string) => void;
  setLocalDescription: (
    id: string,
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  getLocalDescription: (id: string) => RTCSessionDescriptionInit | null;
  setRemoteDescription: (
    id: string,
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  closeConnection: (id: string) => Promise<void>;
  createAnswer: (id: string) => Promise<RTCSessionDescriptionInit>;
  createOffer: (id: string) => Promise<RTCSessionDescriptionInit>;
  addOnIceCandidateCallback: (
    id: string,
    cb: (ev: RTCPeerConnectionIceEvent) => void,
  ) => Promise<void>;
  addOnconnectionstatechangeCallback: (
    id: string,
    cb: (ev: Event) => void,
  ) => Promise<void>;
  addOnTrackCallback: (
    id: string,
    cb: (stream: MediaStream) => void,
  ) => Promise<void>;
  configureRtcTracksCodec: (id: string) => void;
  configureDebug: (id: string) => void;
  configureBitRate: (id: string) => void;
  addIceCandidate: (id: string, ice: RTCIceCandidateInit) => Promise<void>;
  addTracks: (id: string, mediaStream: MediaStream) => void;
  initWebRTCStream: (id: string, mediaStream: MediaStream) => Promise<void>;
};
export const useRTCPeerConnectionsHandler = (
  preferredCodec: string,
): RtcPool => {
  const peerConnectionsRef =
    React.useRef<Map<string, RTCPeerConnection>>(undefined);

  useEffect(() => {
    peerConnectionsRef.current = new Map();
  }, []);

  const getPeerConnection = useCallback((id: string) => {
    if (!peerConnectionsRef.current!.has(id)) {
      throw new Error("Id not found !");
    }
    return peerConnectionsRef.current!.get(id)!;
  }, []);

  const createPeerConnection = useCallback((id: string) => {
    if (peerConnectionsRef.current!.has(id)) {
      throw new Error("Id is already used by another peerConnection !");
    }
    const connection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:signaling-mimishare.emiliethecherry.ovh:3478",
          username: "login",
          credential: "password",
        },
      ],
    });

    peerConnectionsRef.current?.set(id, connection);
  }, []);

  const setLocalDescription = useCallback(
    async (id: string, description: RTCSessionDescriptionInit) => {
      await getPeerConnection(id)?.setLocalDescription(description);
    },
    [getPeerConnection],
  );

  const setRemoteDescription = useCallback(
    async (id: string, description: RTCSessionDescriptionInit) => {
      await getPeerConnection(id)?.setRemoteDescription(description);
    },
    [getPeerConnection],
  );

  const createOffer = useCallback(
    async (id: string) => {
      return await getPeerConnection(id)!.createOffer();
    },
    [getPeerConnection],
  );

  const createAnswer = useCallback(
    async (id: string) => {
      return await getPeerConnection(id)?.createAnswer();
    },
    [getPeerConnection],
  );

  const closeConnection = useCallback(
    async (id: string) => {
      getPeerConnection(id)?.close();
      peerConnectionsRef.current?.delete(id);
    },
    [getPeerConnection],
  );

  const addOnIceCandidateCallback = useCallback(
    async (id: string, cb: (ev: RTCPeerConnectionIceEvent) => void) => {
      getPeerConnection(id)!.onicecandidate = cb;
    },
    [getPeerConnection],
  );

  const addOnconnectionstatechangeCallback = useCallback(
    async (id: string, cb: (ev: Event) => void) => {
      getPeerConnection(id)!.onconnectionstatechange = cb;
    },
    [getPeerConnection],
  );

  const addIceCandidate = useCallback(
    async (id: string, ice: RTCIceCandidateInit) => {
      await getPeerConnection(id)!.addIceCandidate(ice);
    },
    [getPeerConnection],
  );

  const addOnTrackCallback = useCallback(
    async (id: string, cb: (stream: MediaStream) => void) => {
      getPeerConnection(id).ontrack = (event: RTCTrackEvent) => {
        cb(event.streams[0]);
      };
    },
    [getPeerConnection],
  );

  const configureRtcTracksCodec = useCallback(
    (id: string) => {
      const tranceivers = getPeerConnection(id)!.getTransceivers();
      const videoTranceivers = tranceivers?.filter(
        (vt) => vt.sender.track?.kind === "video",
      );

      const videoCapabilities = RTCRtpReceiver.getCapabilities("video")!;
      const preferredCodecsOrder =
        preferredCodec === "VP9"
          ? ["video/VP9", "video/H264", "video/VP8"]
          : ["video/H264", "video/VP9", "video/VP8"];

      const orderedCapabilities = prioritizeCodec(
        videoCapabilities.codecs,
        ...preferredCodecsOrder,
      );
      videoTranceivers?.forEach((vt) =>
        vt.setCodecPreferences(orderedCapabilities),
      );
    },
    [getPeerConnection, preferredCodec],
  );

  const configureBitRate = useCallback(
    (id: string) => {
      const connection = getPeerConnection(id)!;
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") {
          console.log(connection.getSenders());
          const videoSenders = connection
            ?.getSenders()
            .filter((s) => s.track?.kind === "video");
          videoSenders?.forEach(async (vs) => {
            const vsParameters = vs.getParameters();
            vsParameters.encodings[0].maxBitrate = 10000000;
            vsParameters.encodings[0].maxFramerate = 60;
            await vs.setParameters(vsParameters);
          });
        }
      };
    },
    [getPeerConnection],
  );

  const configureDebug = useCallback(
    (id: string) => {
      setInterval(async () => {
        const connection = getPeerConnection(id);
        const stats: RTCStatsReport = await connection.getStats();
        let lastBytes = 0;
        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            console.log(`FPS: ${report.framesPerSecond}`);
            const bitrate = (report.bytesSent - lastBytes) * 8;
            lastBytes = report.bytesSent;
            console.log({
              actualBitrateMbps: (bitrate / 1_000_000).toFixed(2),
              qualityLimitationReason: report.qualityLimitationReason,
              qualityLimitationDurations: report.qualityLimitationDurations,
            });
            const sender = connection
              .getSenders()
              .find((s) => s.track?.kind === "video")!;
            console.log(sender.getParameters());
          }
        });
      }, 1000);
    },
    [getPeerConnection],
  );

  const getLocalDescription = useCallback(
    (id: string) => getPeerConnection(id).localDescription,
    [getPeerConnection],
  );

  const addTracks = useCallback(
    (id: string, mediaStream: MediaStream) => {
      const connection = getPeerConnection(id);
      mediaStream?.getTracks().forEach((t) => {
        connection.addTrack(t, mediaStream);
      });
    },
    [getPeerConnection],
  );

  const initWebRTCStream = useCallback(
    async (id: string, mediaStream: MediaStream) => {
      if (!mediaStream) {
        throw new Error(
          "Media Stream not initialized, can't init WebRTC peer connection !",
        );
      }
      console.log("initializing webrtcstream");
      addTracks(id, mediaStream);
      configureRtcTracksCodec(id);
      configureBitRate(id);
      configureDebug(id);
      const offer = await createOffer(id);
      await setLocalDescription(id, offer);
    },
    [
      addTracks,
      configureBitRate,
      configureDebug,
      configureRtcTracksCodec,
      createOffer,
      setLocalDescription,
    ],
  );

  return {
    createPeerConnection,
    setLocalDescription,
    setRemoteDescription,
    closeConnection,
    createAnswer,
    addOnIceCandidateCallback,
    addOnconnectionstatechangeCallback,
    configureRtcTracksCodec,
    configureDebug,
    configureBitRate,
    createOffer,
    addOnTrackCallback,
    addIceCandidate,
    getLocalDescription,
    addTracks,
    initWebRTCStream,
  };
};
