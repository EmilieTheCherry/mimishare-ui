# Screenshare

Electron app for screen and audio sharing over WebRTC. The host captures a window or display (including its audio via a native WASAPI addon) and streams it to viewers who connect with a room code. Signaling is handled by a Socket.IO server.

**Windows only** — the audio capture addon uses the Windows WASAPI loopback API.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/)
- Python 3.x
- Visual Studio Build Tools with the **Desktop development with C++** workload

Verify node-gyp is available:
```
node-gyp --version
```
If not, install it:
```
npm install -g node-gyp
```

## Setup

```
pnpm install
```

## Build the native audio addon

The audio capture addon must be compiled before running or packaging the app.

```
cd native
node-gyp configure
node-gyp build
```

The compiled addon ends up at `native/build/Release/audio_capture.node`.

## Environment

Copy `.env.example` to `.env` and fill in your signaling server details:

```
VITE_SIGNALINGSERVER_URL=localhost
VITE_SIGNALINGSERVER_PORT=3000
VITE_NODE_ENV=development
```

For a production build, edit `.env.production` with your real server address.

## Development

```
pnpm dev
```

To test the viewer side locally in a second Electron window:
```
pnpm dev:viewer
```

## Package for distribution

```
pnpm dist
```

This compiles TypeScript, builds the Vite bundle with `.env.production`, and packages everything into an NSIS installer under `release/`.
