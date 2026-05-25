export const prioritizeCodec = (
  availableCodecs: RTCRtpCodec[],
  ...mimeTypePriority: string[]
): RTCRtpCodec[] => {
  const prioritized: Map<string, RTCRtpCodec[]> = new Map();
  const others: RTCRtpCodec[] = [];

  availableCodecs.forEach((availableCodec) => {
    const mimeType = availableCodec.mimeType;
    if (!mimeTypePriority.includes(mimeType)) {
      others.push(availableCodec);
    }

    if (!prioritized.has(mimeType)) {
      prioritized.set(mimeType, []);
    }

    prioritized.get(mimeType)!.push(availableCodec);
  });

  const orderedAsArray = mimeTypePriority.flatMap(
    (mimeType) => prioritized.get(mimeType)!,
  );

  return [...orderedAsArray.filter(Boolean), ...others];
};
