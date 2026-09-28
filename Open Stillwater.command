#!/bin/zsh

APP_DIR="${0:A:h}"
PORT="4173"
URL="http://127.0.0.1:${PORT}/FishingRadar.html"

cd "$APP_DIR" || exit 1

if curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

echo "Starting Stillwater…"
python3 -m http.server "$PORT" &
SERVER_PID=$!

for _ in {1..20}; do
  if curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
    open "$URL"
    echo "Stillwater is running. Keep this window open; press Control-C to stop."
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 0.1
done

echo "Stillwater could not start on port $PORT."
kill "$SERVER_PID" >/dev/null 2>&1
exit 1
