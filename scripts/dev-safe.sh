#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-4013}"
PID="$(lsof -ti tcp:"$PORT" || true)"
if [ -n "$PID" ]; then
  echo "Port $PORT already in use. Stopping PID(s): $PID"
  kill -9 $PID
fi
PORT="$PORT" npm run dev
