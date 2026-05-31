import { useMemo } from "react";
import { useStreamSettingsContext } from "../../../context/StreamSettingsContext";
import {
  type RESOLUTIONS_IDS_TYPE,
  CODEC,
  RESOLUTION,
  VIDEO_CONTENT_HINT,
} from "../../../type/Settings";
import { upperFirstChar } from "../../../util/uppperFirstChar";
import { NumberInput } from "../../Controls/NumberInput";
import { SelectInput } from "../../Controls/SelectInput";

export const HostConfiguration = () => {
  const {
    preferredCodec,
    setPreferredCodec,
    captureTargetFps,
    setCaptureTargetFps,
    videoContentHint,
    setVideoContentHint,
    resolutionId,
    setResolutionId,
  } = useStreamSettingsContext();

  const resolutionOptions = useMemo<
    { label: string; value: RESOLUTIONS_IDS_TYPE }[]
  >(() => {
    return (Object.keys(RESOLUTION) as RESOLUTIONS_IDS_TYPE[]).map(
      (resKey) => ({
        label: RESOLUTION[resKey].label,
        value: resKey,
      }),
    );
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <span className="select-none text-center mb-7">Stream Settings</span>
      <p>Resolution</p>
      <SelectInput
        value={resolutionId}
        onChange={setResolutionId}
        options={resolutionOptions}
      />
      <p>Video Type</p>
      <SelectInput
        value={videoContentHint}
        onChange={setVideoContentHint}
        options={[
          {
            label: upperFirstChar(VIDEO_CONTENT_HINT.MOTION),
            value: VIDEO_CONTENT_HINT.MOTION,
          },
          {
            label: upperFirstChar(VIDEO_CONTENT_HINT.DETAIL),
            value: VIDEO_CONTENT_HINT.DETAIL,
          },
        ]}
      />
      <p>Preferred Codec</p>
      <SelectInput
        value={preferredCodec}
        onChange={setPreferredCodec}
        options={[
          { label: CODEC.VP9, value: CODEC.VP9 },
          { label: CODEC.H264, value: CODEC.H264 },
        ]}
      />
      <p>Target framerate</p>
      <NumberInput
        value={captureTargetFps}
        onChange={setCaptureTargetFps}
        min={1}
        max={60}
      />
    </div>
  );
};
