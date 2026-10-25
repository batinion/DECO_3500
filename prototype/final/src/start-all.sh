#!/bin/sh
# Starts the full Launch Sequence game; Ctrl+C stops it.
#   http://localhost:4000  full Launch Sequence game
cd "$(dirname "$0")/server" || exit 1
[ -d node_modules ] || npm install
exec npm start
