export interface AudioFormat {
  sampleRate: number;
  channels: number;
}

export interface Source {
  id: string;
  name: string;
  thumbnail: string;
  isDisplay: boolean;
  pid: number | null;
}

declare global {
  interface Window {
    audioCapture?: {
      list: () => Promise<unknown>;
      start: (pid: number) => Promise<void>;
      stop: () => Promise<void>;
      onFormat: (cb: (fmt: AudioFormat) => void) => void;
      onChunk: (cb: (ab: ArrayBuffer) => void) => void;
      onError: (cb: (msg: string) => void) => void;
      removeAll: () => void;
    };
    windowControls?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
    screenCapture?: {
      setSource: (id: string) => Promise<void>;
    };
    sources?: {
      list: () => Promise<Source[]>;
    };
  }
}
