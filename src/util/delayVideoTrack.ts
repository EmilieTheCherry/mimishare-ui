type BufferedFrame = {
  bmp: ImageBitmap;
  timestamp: number;
  duration: number | null;
};

const createTransformerFunction = (
  delayMsRef: { current: number },
): Transformer<VideoFrame, VideoFrame> => {
  const buffer: BufferedFrame[] = [];

  return {
    transform: async (frame, controller) => {
      const { timestamp, duration } = frame;
      const bmp = await createImageBitmap(frame);
      frame.close();

      buffer.push({ bmp, timestamp, duration });

      const delayMicroSecond = delayMsRef.current * 1000;
      while (
        buffer.length > 1 &&
        buffer[buffer.length - 1].timestamp - buffer[0].timestamp >=
          delayMicroSecond
      ) {
        const oldest = buffer.shift()!;
        controller.enqueue(
          new VideoFrame(oldest.bmp, {
            timestamp: oldest.timestamp + delayMicroSecond,
            ...(oldest.duration != null && { duration: oldest.duration }),
          }),
        );
        oldest.bmp.close();
      }
    },

    flush: (ctrl) => {
      const delayMicroSecond = delayMsRef.current * 1000;
      for (const { bmp, timestamp, duration } of buffer) {
        ctrl.enqueue(
          new VideoFrame(bmp, {
            timestamp: timestamp + delayMicroSecond,
            ...(duration != null && { duration }),
          }),
        );
        bmp.close();
      }
      buffer.length = 0;
    },
  };
};

export function delayVideoTrack(
  track: MediaStreamTrack,
  delayMsRef: { current: number },
): MediaStreamTrack {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).MediaStreamTrackProcessor === "undefined") {
    console.warn(
      "[delayVideoTrack] MediaStreamTrackProcessor unavailable, skipping delay",
    );
    return track;
  }

  try {
    // @ts-expect-error — Insertable Streams not yet in TS DOM lib types
    const processor = new MediaStreamTrackProcessor({ track });
    // @ts-expect-error — Insertable Streams not yet in TS DOM lib types
    const generator = new MediaStreamTrackGenerator({ kind: "video" });

    const transformer = new TransformStream<VideoFrame, VideoFrame>(
      createTransformerFunction(delayMsRef),
    );

    processor.readable
      .pipeThrough(transformer)
      .pipeTo(generator.writable)
      .catch(console.error);
    return generator as unknown as MediaStreamTrack;
  } catch (e) {
    console.error(
      "[delayVideoTrack] Pipeline setup failed, falling back to no delay:",
      e,
    );
    return track;
  }
}
