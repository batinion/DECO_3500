#!/bin/sh
# Colour restore - standalone. Starts the server, then open the link it prints.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm start
