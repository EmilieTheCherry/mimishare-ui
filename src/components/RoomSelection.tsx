import { useCallback, useMemo, useState } from "react";
import { useRoom } from "../hooks/useRoom";
import { Button } from "./Controls/Button";
import React from "react";
import { TextInput } from "./Controls/TextInput";
import { NumberInput } from "./Controls/NumberInput";
import { SelectInput } from "./Controls/SelectInput";
import { upperFirstChar } from "../util/uppperFirstChar";
import { useStreamSettingsContext } from "../context/StreamSettingsContext";
import {
  CODEC,
  RESOLUTION,
  RESOLUTIONS_IDS,
  VIDEO_CONTENT_HINT,
  type ResolutionDetails,
  type RESOLUTIONS_IDS_TYPE,
} from "../type/Settings";

type PropsType = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

export const RoomSelection = ({ videoRef }: PropsType) => {
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
  const [roomCode, setRoomCode] = useState<string>("");
  const { onCreateRoomClicked, onJoinRoomClicked } = useRoom(videoRef);

  const handleJoinRoomClicked = useCallback(() => {
    onJoinRoomClicked(roomCode);
  }, [onJoinRoomClicked, roomCode]);

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
    <div className="w-full h-full flex justify-center items-center gap-32">
      <div className="flex flex-col gap-4">
        <p className="text-center">Resolution</p>
        <SelectInput
          value={resolutionId}
          onChange={setResolutionId}
          options={resolutionOptions}
        />
        <p className="text-center">Video Type</p>
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
        <p className="text-center">Preferred Codec</p>
        <SelectInput
          value={preferredCodec}
          onChange={setPreferredCodec}
          options={[
            {
              label: CODEC.VP9,
              value: CODEC.VP9,
            },
            {
              label: CODEC.H264,
              value: CODEC.H264,
            },
          ]}
        />
        <p className="text-center">Target framerate</p>
        <NumberInput
          value={captureTargetFps}
          onChange={setCaptureTargetFps}
          min={1}
          max={60}
        />
        <Button label="Create Room" onClick={onCreateRoomClicked} />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-center">Join room with code</p>
        <TextInput
          value={roomCode}
          onChange={setRoomCode}
          placeholder="Room Code"
        />
        <Button label="Join Room" onClick={handleJoinRoomClicked} />
      </div>
    </div>
  );
};
