export const setVideoTracksContentHint = async (
  stream: MediaStream,
  contentHint: "motion" | "detail",
) => {
  stream?.getTracks().forEach((t) => {
    if (t.kind === "video") {
      t.contentHint = contentHint;
    }
  });
};
