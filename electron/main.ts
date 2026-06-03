import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
} from "electron";
import path from "path";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const isDev = !app.isPackaged;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (app.commandLine.hasSwitch("viewer")) {
  app.setPath(
    "userData",
    path.join(app.getPath("temp"), "screenshare-ui-viewer"),
  );
}

interface AudioSession {
  pid: number;
  name: string;
  displayName: string;
}

interface AudioFormat {
  sampleRate: number;
  channels: number;
}

interface NativeAddon {
  enumerateAudioSessions: () => AudioSession[];
  startCapture: (
    pid: number,
    callbacks: {
      onFormat: (fmt: AudioFormat) => void;
      onChunk: (buf: ArrayBuffer) => void;
      onError: (msg: string) => void;
      includeChildren: boolean;
    },
  ) => void;
  stopCapture: () => void;
}

interface SourceItem {
  id: string;
  name: string;
  thumbnail: string;
  isDisplay: boolean;
  pid: number | null;
}

// ── Native addon ──────────────────────────────────────────────────────────────

let addon: NativeAddon | null = null;

const addonCandidates = isDev
  ? [
      path.join(
        import.meta.dirname,
        "../native/build/Release/audio_capture.node",
      ),
      path.join(app.getAppPath(), "native/build/Release/audio_capture.node"),
    ]
  : [path.join(process.resourcesPath, "audio_capture.node")];

for (const candidate of addonCandidates) {
  try {
    addon = _require(candidate) as NativeAddon;
    console.log("[main] Native addon loaded from:", candidate);
    break;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.warn(
      "[main] Addon not at:",
      candidate,
      "—",
      err.code ?? err.message,
    );
  }
}

if (!addon) {
  console.error(
    "[main] Native addon could not be loaded. Audio features disabled.",
  );
}

// ── Window ────────────────────────────────────────────────────────────────────

let win: BrowserWindow | null = null;
let pendingSourceId: string | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(import.meta.dirname, "../dist/index.html"));
  }
  if (isDev) win.webContents.openDevTools({ mode: "right" });

  win.removeMenu();
  win.on("closed", () => {
    stopCapture();
    win = null;
  });

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      if (!pendingSourceId) {
        callback({});
        return;
      }
      const id = pendingSourceId;
      pendingSourceId = null;
      try {
        const sources = await desktopCapturer.getSources({
          types: ["window", "screen"],
          thumbnailSize: { width: 0, height: 0 },
        });
        const source = sources.find((s) => s.id === id);
        callback(source ? { video: source } : {});
      } catch (e) {
        console.error("[main] desktopCapturer error:", e);
        callback({});
      }
    },
  );
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!win) createWindow();
});

// In main.js
app.on("gpu-info-update", async () => {
  console.log(await app.getGPUInfo("basic"));
});

// ── Window controls ───────────────────────────────────────────────────────────

ipcMain.on("window:minimize", () => win?.minimize());
ipcMain.on("window:maximize", () => {
  const w = win;
  if (!w || !w.isMaximizable) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on("window:close", () => win?.close());

// ── Source list ───────────────────────────────────────────────────────────────

function matchWindowToPid(
  windowName: string,
  sessions: AudioSession[],
): number | null {
  const lower = windowName.toLowerCase();
  for (const s of sessions) {
    const exe = (s.name || "").replace(/\.exe$/i, "").toLowerCase();
    const display = (s.displayName || "").toLowerCase();
    if ((display && lower.includes(display)) || (exe && lower.includes(exe)))
      return s.pid;
  }
  return null;
}

ipcMain.handle("sources:list", async (): Promise<SourceItem[]> => {
  let desktopSources: Electron.DesktopCapturerSource[] = [];
  let sessions: AudioSession[] = [];

  try {
    desktopSources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 800, height: 450 },
    });
  } catch (e) {
    console.error("[main] desktopCapturer error:", e);
  }

  if (addon) {
    try {
      const raw = addon.enumerateAudioSessions();
      const seen = new Set<number>();
      sessions = raw.filter((s) => !seen.has(s.pid) && seen.add(s.pid));
    } catch (e) {
      console.error("[main] enumerateAudioSessions error:", e);
    }
  }

  const appName = app.getName().toLowerCase();

  return desktopSources
    .filter((s) => {
      if (!s.name || !s.name.trim()) return false;
      if (s.name.toLowerCase() === appName) return false;
      return true;
    })
    .map((s): SourceItem => {
      const isDisplay = s.id.startsWith("screen:");
      return {
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        isDisplay,
        pid: isDisplay ? 0 : matchWindowToPid(s.name, sessions),
      };
    });
});

// ── Audio IPC ─────────────────────────────────────────────────────────────────

function stopCapture(): void {
  try {
    addon?.stopCapture();
  } catch (_) {}
}

ipcMain.handle("audio:start", (event, pid: number) => {
  if (!addon) {
    event.sender.send("audio:error", "Native addon not loaded");
    return;
  }
  stopCapture();
  console.log(`[main] Starting capture for PID ${pid}`);
  addon.startCapture(pid, {
    onFormat(fmt: AudioFormat) {
      console.log(`[main] Format: ${fmt.sampleRate}Hz ${fmt.channels}ch`);
      win?.webContents.send("audio:format", fmt);
    },
    onChunk(buf: ArrayBuffer) {
      if (win) win.webContents.send("audio:chunk", Buffer.from(buf));
    },
    onError(msg: string) {
      console.error("[main] Capture error:", msg);
      win?.webContents.send("audio:error", msg);
    },
    includeChildren: true,
  });
});

ipcMain.handle("audio:stop", () => stopCapture());

// ── Screen capture ────────────────────────────────────────────────────────────

ipcMain.handle("screen:setSource", (_event, id: string) => {
  pendingSourceId = id;
});
