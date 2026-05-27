export class ThrottledScreenCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private targetFps: number = 0;
  private frameInterval: number = 0;

  async start(targetFps: number): Promise<MediaStream> {
    this.targetFps = targetFps;
    this.frameInterval = 1000 / targetFps;

    // 1. Grab the raw screen stream (unconstrained, let browser do what it wants)
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1920, height: 1080 },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    // 2. Feed raw stream into a hidden <video>
    this.videoElement = document.createElement("video");
    this.videoElement.srcObject = this.stream;
    this.videoElement.muted = true;
    await this.videoElement.play();

    // 3. Set up canvas to draw throttled frames onto
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext("2d")!;

    // 4. Start the throttled draw loop
    this.animFrameId = requestAnimationFrame(this.loop);

    // 5. Return a new stream from the canvas — this is your throttled output
    const throttledStream = this.canvas.captureStream(this.targetFps);
    const audioTracks = this.stream!.getAudioTracks();
    audioTracks.forEach((t) => throttledStream.addTrack(t));
    return throttledStream;
  }

  private loop = (now: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop);

    const elapsed = now - this.lastFrameTime;
    if (elapsed < this.frameInterval) return; // too soon, skip frame

    // Snap to the nearest frame boundary to avoid drift
    this.lastFrameTime = now - (elapsed % this.frameInterval);

    if (!this.videoElement || !this.ctx) return;
    this.ctx.drawImage(this.videoElement, 0, 0, 1920, 1080);
  };

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.videoElement?.remove();
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
  }
}
