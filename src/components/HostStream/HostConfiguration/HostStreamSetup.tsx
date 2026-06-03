import { Button } from "../../Controls/Button";
import { SourcePicker } from "../Sources/SourcePicker";
import { HostConfiguration } from "./HostConfiguration";
import { useHostStreamSetup } from "../../../hooks/useHostStreamSetup";

export const HostStreamSetup = () => {
  const {
    handleConfirm,
    handleReturn,
    selectedVideoSource,
    setSelectedVideoSource,
  } = useHostStreamSetup();
  return (
    <div className="w-full h-full flex">
      <div className="flex-0">
        <HostConfiguration />
      </div>
      <div className="flex flex-col justify-between flex-1 border-l-2 border-l-elevated ml-8 pl-2">
        <SourcePicker
          selectedSource={selectedVideoSource}
          setSelectedSource={setSelectedVideoSource}
        />
        <div className="flex gap-4 justify-end">
          <Button
            label="Cancel"
            onClick={handleReturn}
            size="SMALL"
            variant="SECONDARY"
          />
          <Button
            label="Confirm"
            onClick={handleConfirm}
            size="SMALL"
            disabled={selectedVideoSource == undefined}
          />
        </div>
      </div>
    </div>
  );
};
