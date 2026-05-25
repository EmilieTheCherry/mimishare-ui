#!/bin/sh
cat > /usr/share/nginx/html/env-config.js << EOF
window.__ENV__ = {
  "VITE_SIGNALINGSERVER_URL": "${VITE_SIGNALINGSERVER_URL:-localhost}",
  "VITE_SIGNALINGSERVER_PORT": "${VITE_SIGNALINGSERVER_PORT:-3000}",
  "VITE_NODE_ENV": "${VITE_NODE_ENV:-production}"
};
EOF
exec "$@"