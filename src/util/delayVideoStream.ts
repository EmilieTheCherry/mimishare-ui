import { delayVideoTrack } from "./delayVideoTrack";

export const delayVideoStream = (
  videoStream: MediaStream,
  delayMsRef: { current: number },
) => {
  const [originalVideoTrack] = videoStream.getVideoTracks();
  const delayedVideoTrack = delayVideoTrack(originalVideoTrack, delayMsRef);

  const delayedVideoStream = new MediaStream();
  delayedVideoStream.addTrack(delayedVideoTrack);

  return delayedVideoStream;
};
