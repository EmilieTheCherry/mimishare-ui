class PcmFeederProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this._ch = opts.processorOptions?.channels ?? 2;
    this._queue = [];
    this.port.onmessage = ({ data }) => {
      this._queue.push(new Float32Array(data));
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const len = out[0].length;
    let filled = 0;

    while (filled < len && this._queue.length > 0) {
      const chunk = this._queue[0];
      const frames = chunk.length / this._ch;
      const take = Math.min(frames, len - filled);

      for (let c = 0; c < out.length; c++) {
        const srcCh = Math.min(c, this._ch - 1);
        for (let i = 0; i < take; i++) {
          out[c][filled + i] = chunk[i * this._ch + srcCh];
        }
      }

      if (take < frames) {
        this._queue[0] = chunk.subarray(take * this._ch);
      } else {
        this._queue.shift();
      }
      filled += take;
    }

    // Report queue depth every ~100ms (every 34 quanta at 44100Hz)
    if (currentFrame % ((sampleRate / 10) | 0) < len) {
      const queued = this._queue.reduce((s, c) => s + c.length / this._ch, 0);
      this.port.postMessage({ queuedSamples: queued });
    }

    return true;
  }
}

registerProcessor("pcm-feeder", PcmFeederProcessor);
