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
  /** Continuously updated total audio pipeline latency in ms.
   *  Starts near 0 and stabilises once the worklet queue reaches steady state. */
  latencyMsRef: RefObject<number>;
}

const IPC_SAMPLE_WINDOW = 20;

export function useAppAudio(): UseAppAudioReturn {
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<AudioFormat | null>(null);
  const [activePid, setActivePid] = useState<number | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ipcSamplesRef = useRef<number[]>([]);
  const workletQueueMsRef = useRef<number>(0);
  const latencyMsRef = useRef<number>(0);

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
    ipcSamplesRef.current = [];
    workletQueueMsRef.current = 0;
    latencyMsRef.current = 0;
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

        ipcSamplesRef.current = [];
        workletQueueMsRef.current = 0;
        latencyMsRef.current = 0;

        const recomputeLatency = () => {
          const samples = ipcSamplesRef.current;
          if (samples.length === 0) return;
          const sorted = [...samples].sort((a, b) => a - b);
          const ipcMedian = sorted[Math.floor(sorted.length / 2)];
          const webAudioMs =
            ((ctxRef.current?.baseLatency ?? 0) +
              (ctxRef.current?.outputLatency ?? 0)) *
            1000;
          latencyMsRef.current =
            ipcMedian + workletQueueMsRef.current + webAudioMs;
        };

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

          worklet.port.onmessage = (e) => {
            if (e.data?.queuedSamples !== undefined) {
              workletQueueMsRef.current =
                (e.data.queuedSamples / fmt.sampleRate) * 1000;
              recomputeLatency();
              console.log(
                `[audio] latency: ${latencyMsRef.current.toFixed(0)} ms` +
                  `  (queue: ${workletQueueMsRef.current.toFixed(0)} ms)`,
              );
            }
          };

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
          const captureMs = new Float64Array(buf, 0, 1)[0];
          const pcm = buf.slice(8);
          workletRef.current?.port.postMessage(pcm, [pcm]);

          const samples = ipcSamplesRef.current;
          samples.push(Date.now() - captureMs);
          if (samples.length > IPC_SAMPLE_WINDOW) samples.shift();
          recomputeLatency();
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
    latencyMsRef,
  };
}
