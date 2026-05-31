import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type RefObject,
} from "react";
import type { AudioFormat } from "../types/window";

export type AudioStatus = "idle" | "activating" | "capturing" | "error";

export interface UseAppAudioReturn {
  start: (pid: number) => Promise<MediaStream>;
  stop: () => Promise<void>;
  status: AudioStatus;
  error: string | null;
  format: AudioFormat | null;
  activePid: number | null;
  streamRef: RefObject<MediaStream | null>;
}

export function useAppAudio(): UseAppAudioReturn {
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<AudioFormat | null>(null);
  const [activePid, setActivePid] = useState<number | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const teardown = useCallback(async () => {
    window.audioCapture?.removeAll();
    try {
      await window.audioCapture?.stop();
    } catch (_) {}
    workletRef.current?.disconnect();
    destRef.current?.disconnect();
    if (ctxRef.current?.state !== "closed")
      await ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    workletRef.current = null;
    destRef.current = null;
    streamRef.current = null;
    setStatus("idle");
    setFormat(null);
    setActivePid(null);
  }, []);

  useEffect(
    () => () => {
      teardown();
    },
    [teardown],
  );

  const start = useCallback(
    (pid: number): Promise<MediaStream> =>
      new Promise(async (resolve, reject) => {
        setError(null);
        setStatus("activating");
        if (ctxRef.current) await teardown();
        setActivePid(pid);

        if (!window.audioCapture) {
          const msg =
            "window.audioCapture not found — is Electron preload loaded?";
          setError(msg);
          setStatus("error");
          return reject(new Error(msg));
        }

        let resolved = false;

        window.audioCapture.onFormat(async (fmt: AudioFormat) => {
          setFormat(fmt);

          const ctx = new AudioContext({
            sampleRate: fmt.sampleRate,
            latencyHint: "interactive",
          });
          ctxRef.current = ctx;
          await ctx.resume();

          try {
            await ctx.audioWorklet.addModule("/pcm-feeder-processor.js");
          } catch (e) {
            const err = e as Error;
            setError(err.message);
            setStatus("error");
            return reject(err);
          }

          const worklet = new AudioWorkletNode(ctx, "pcm-feeder", {
            outputChannelCount: [fmt.channels],
            processorOptions: { channels: fmt.channels },
          });
          workletRef.current = worklet;

          const dest = ctx.createMediaStreamDestination();
          destRef.current = dest;
          streamRef.current = dest.stream;
          worklet.connect(dest);

          setStatus("capturing");

          if (!resolved) {
            resolved = true;
            resolve(dest.stream);
          }
        });

        window.audioCapture.onChunk((buf: ArrayBuffer) => {
          console.log(
            "[audio] chunk received, byteLength:",
            buf.byteLength,
            "worklet ready:",
            !!workletRef.current,
          );

          workletRef.current?.port.postMessage(buf, [buf]);
        });

        window.audioCapture.onError((msg: string) => {
          setError(msg);
          setStatus("error");
          if (!resolved) {
            resolved = true;
            reject(new Error(msg));
          }
        });

        try {
          await window.audioCapture.start(pid);
        } catch (e) {
          const err = e as Error;
          setError(err.message);
          setStatus("error");
          reject(err);
        }
      }),
    [teardown],
  );

  const stop = useCallback(async () => {
    await teardown();
  }, [teardown]);

  return {
    start,
    stop,
    status,
    error,
    format,
    activePid,
    streamRef,
  };
}
