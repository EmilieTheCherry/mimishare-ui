import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("audioCapture", {
  list: () => ipcRenderer.invoke("audio:list"),
  start: (pid: number) => ipcRenderer.invoke("audio:start", pid),
  stop: () => ipcRenderer.invoke("audio:stop"),

  onFormat: (cb: (fmt: unknown) => void) =>
    ipcRenderer.on("audio:format", (_, fmt) => cb(fmt)),
  onChunk: (cb: (ab: ArrayBuffer) => void) =>
    ipcRenderer.on("audio:chunk", (_, buf: Buffer) => {
      // buf arrives as a Node Buffer; wrap its ArrayBuffer as a copy so the
      // underlying Buffer memory isn't shared across the IPC boundary.
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      cb(ab);
    }),
  onError: (cb: (msg: string) => void) =>
    ipcRenderer.on("audio:error", (_, msg) => cb(msg)),
  removeAll: () => {
    ipcRenderer.removeAllListeners("audio:format");
    ipcRenderer.removeAllListeners("audio:chunk");
    ipcRenderer.removeAllListeners("audio:error");
  },
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});

contextBridge.exposeInMainWorld("screenCapture", {
  setSource: (id: string) => ipcRenderer.invoke("screen:setSource", id),
});

contextBridge.exposeInMainWorld("sources", {
  list: () => ipcRenderer.invoke("sources:list"),
});
