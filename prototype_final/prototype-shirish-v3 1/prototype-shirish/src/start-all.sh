#!/bin/sh
# Starts all three servers in the background; Ctrl+C stops them all.
#   http://localhost:4000  full Launch Sequence game
#   http://localhost:4001  Rescue your memories (standalone)
#   http://localhost:4002  Colour restore (standalone)
cd "$(dirname "$0")" || exit 1
for d in server rescue-game colour-game; do
  [ -d "$d/node_modules" ] || (cd "$d" && npm install)
done
pids=""
for d in server rescue-game colour-game; do
  (cd "$d" && exec npm start) &
  pids="$pids $!"
done
trap 'kill $pids 2>/dev/null' INT TERM
wait
