export const VIDEO_CONTENT_HINT = {
  MOTION: "motion",
  DETAIL: "detail",
} as const;

export type VideoContentHintType =
  (typeof VIDEO_CONTENT_HINT)[keyof typeof VIDEO_CONTENT_HINT];

export const CODEC = {
  H264: "H264",
  VP9: "VP9",
} as const;

export type CodecType = (typeof CODEC)[keyof typeof CODEC];

export type ResolutionDetails = {
  width: number;
  height: number;
  label: string;
};

export const RESOLUTIONS_IDS = {
  R1080P: "R1080P",
  R720P: "R720P",
  R480P: "R480P",
} as const;

export type RESOLUTIONS_IDS_TYPE = keyof typeof RESOLUTIONS_IDS;

export const RESOLUTION: Record<
  keyof typeof RESOLUTIONS_IDS,
  ResolutionDetails
> = {
  [RESOLUTIONS_IDS.R1080P]: {
    width: 1920,
    height: 1080,
    label: "1080P",
  },
  [RESOLUTIONS_IDS.R720P]: {
    width: 1280,
    height: 720,
    label: "720P",
  },
  [RESOLUTIONS_IDS.R480P]: {
    width: 854,
    height: 480,
    label: "480P",
  },
} as const;
