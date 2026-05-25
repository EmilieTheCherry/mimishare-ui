import { useCallback } from "react";
import { prioritizeCodec } from "../util/codecOrdering";
import { useAppContext } from "../context/AppContext";

export const useHostStream = () => {
  const { peerConnectionRef } = useAppContext();

  const configureRtcTracksCodec = useCallback(() => {
    const tranceivers = peerConnectionRef.current?.getTransceivers();
    const videoTranceivers = tranceivers?.filter(
      (vt) => vt.sender.track?.kind === "video",
    );

    const videoCapabilities = RTCRtpReceiver.getCapabilities("video")!;
    const orderedCapabilities = prioritizeCodec(
      videoCapabilities.codecs,
      "video/VP9",
      "video/VP8",
      "video/H264",
    );
    videoTranceivers?.forEach((vt) =>
      vt.setCodecPreferences(orderedCapabilities),
    );
  }, [peerConnectionRef]);

  const configureBitRate = useCallback(() => {
    peerConnectionRef.current!.onconnectionstatechange = () => {
      if (peerConnectionRef.current?.connectionState === "connected") {
        console.log(peerConnectionRef.current?.getSenders());
        const videoSenders = peerConnectionRef.current
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
  }, [peerConnectionRef]);

  const configureDebug = useCallback(() => {
    console.log(peerConnectionRef);
    setInterval(async () => {
      const stats: RTCStatsReport = await peerConnectionRef.current!.getStats();
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
          const sender = peerConnectionRef
            .current!.getSenders()
            .find((s) => s.track?.kind === "video")!;
          console.log(sender.getParameters());
        }
      });
    }, 1000);
  }, [peerConnectionRef]);

  const setupHost = useCallback(
    async (stream: MediaStream) => {
      if (!peerConnectionRef.current) {
        throw new Error("Peer connection not ready for setup !");
      }
      stream?.getTracks().forEach((t) => {
        if (t.kind === "video") {
          t.contentHint = "motion";
        }
        peerConnectionRef.current!.addTrack(t, stream);
      });
      configureRtcTracksCodec();
      configureBitRate();
      configureDebug();

      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
    },
    [
      configureBitRate,
      configureDebug,
      configureRtcTracksCodec,
      peerConnectionRef,
    ],
  );

  const setupOnTrack = useCallback(
    (cb: (stream: MediaStream) => void) => {
      peerConnectionRef.current!.ontrack = (event: RTCTrackEvent) => {
        cb(event.streams[0]);
      };
    },
    [peerConnectionRef],
  );

  const setupViewer = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement>) => {
      setupOnTrack((stream: MediaStream) => {
        videoRef.current!.srcObject = stream;
      });

      setInterval(async () => {
        const stats = await peerConnectionRef.current!.getStats();
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            console.log({
              fps: report.framesPerSecond,
              bitrate: report.bytesReceived,
              width: report.frameWidth,
              height: report.frameHeight,
              jitter: report.jitter,
              packetsLost: report.packetsLost,
              packetsReceived: report.packetsReceived,
            });
          } else if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            console.log(report);
          }
        });
      }, 1000);
    },
    [peerConnectionRef, setupOnTrack],
  );

  return {
    peerConnectionRef,
    setupHost,
    setupViewer,
    setupOnTrack,
  };
};
